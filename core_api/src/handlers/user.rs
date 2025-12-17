/*
 * src/handlers/user.rs
 * 修复逻辑:
 * 1. get_hq_users: SQL 查询增加 u.staff_status::text
 * 2. create_hq_user: 返回的 UserDetail JSON 中增加 staff_status
 */
use axum::{extract::State, http::StatusCode, Json};
use uuid::Uuid;
use bcrypt::{hash, DEFAULT_COST};
use crate::models::{Claims, UserDetail, CreateUserPayload, UpdateStatusPayload, UpdateUserPayload};
use super::{AppState};

use sqlx::{QueryBuilder};
use rand::{seq::SliceRandom};

fn generate_strong_password() -> String {
    let mut rng = rand::thread_rng();
    let upper: Vec<char> = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".chars().collect();
    let lower: Vec<char> = "abcdefghijklmnopqrstuvwxyz".chars().collect();
    let numbers: Vec<char> = "0123456789".chars().collect();
    let special: Vec<char> = "!@#$%^&*".chars().collect();
    let mut password: Vec<char> = Vec::new();
    password.push(*upper.choose(&mut rng).unwrap());
    password.push(*lower.choose(&mut rng).unwrap());
    password.push(*numbers.choose(&mut rng).unwrap());
    password.push(*special.choose(&mut rng).unwrap());
    let all_chars = [upper, lower, numbers, special].concat();
    for _ in 0..4 { password.push(*all_chars.choose(&mut rng).unwrap()); }
    password.shuffle(&mut rng);
    password.into_iter().collect()
}

// (GET) 获取员工列表
pub async fn get_hq_users(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<UserDetail>>, StatusCode> {
    
    let hq_id = claims.hq_id;
    let is_hq = claims.roles.iter().any(|r| r == "role.hq.admin");
    let is_base = claims.roles.iter().any(|r| r == "role.base.admin");

    if !is_hq && !is_base {
        return Err(StatusCode::FORBIDDEN);
    }

    // ★★★ [修复 1] SQL 查询增加 u.staff_status::text ★★★
    // 同时也补上了 skills 和 is_teaching_now 的查询逻辑
    let mut query_builder: QueryBuilder<sqlx::Postgres> = QueryBuilder::new(
        r#"
        SELECT 
            u.id, u.email, u.full_name, u.is_active, u.created_at,
            u.phone_number, u.gender, u.blood_type, u.date_of_birth, u.address,
            
            u.staff_status::text, -- <--- 关键修复: 查出状态

            u.base_id,
            b.name as base_name,
            (SELECT r.name_key FROM roles r 
             JOIN user_roles ur ON r.id = ur.role_id 
             WHERE ur.user_id = u.id LIMIT 1) as role_name,
             
            (SELECT STRING_AGG(c.name_key, ', ')
             FROM teacher_qualified_courses tqc
             JOIN courses c ON tqc.course_id = c.id
             WHERE tqc.teacher_id = u.id) as skills,
             
            EXISTS (
                SELECT 1 FROM classes cl
                JOIN class_teachers ct ON cl.id = ct.class_id
                WHERE ct.teacher_id = u.id
                AND cl.status = 'scheduled'
                AND CURRENT_TIMESTAMP BETWEEN cl.start_time AND cl.end_time
            ) as is_teaching_now

        FROM users u
        LEFT JOIN bases b ON u.base_id = b.id
        WHERE u.hq_id = 
        "#
    );

    query_builder.push_bind(hq_id);

    if !is_hq && is_base {
        if let Some(base_id) = claims.base_id {
            query_builder.push(" AND u.base_id = ");
            query_builder.push_bind(base_id);
        } else {
            return Err(StatusCode::FORBIDDEN);
        }
    }

    query_builder.push(" ORDER BY u.created_at DESC ");

    let users = query_builder.build_query_as::<UserDetail>()
        .fetch_all(&state.db_pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch users: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(users))
}

// (POST) 创建新员工
pub async fn create_hq_user(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateUserPayload>,
) -> Result<Json<UserDetail>, StatusCode> {
    
    let is_hq = claims.roles.iter().any(|r| r == "role.hq.admin");
    let is_base = claims.roles.iter().any(|r| r == "role.base.admin");

    if !is_hq && !is_base {
        return Err(StatusCode::FORBIDDEN);
    }

    let (final_base_id, final_role_key) = if is_hq {
        (payload.base_id, payload.role_key.clone())
    } else {
        let my_base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;
        let allowed_roles = vec!["role.base.academic", "role.base.finance", "role.teacher", "role.base.hr"];
        if !allowed_roles.contains(&payload.role_key.as_str()) {
            return Err(StatusCode::FORBIDDEN);
        }
        (Some(my_base_id), payload.role_key.clone())
    };

    let mut tx = state.db_pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let plain_password = payload.password.clone().unwrap_or_else(generate_strong_password);
    let password_hash = hash(&plain_password, DEFAULT_COST).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 这里 INSERT 默认用数据库的 staff_status='active'，所以不用改 SQL
    let user_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO users (
            hq_id, base_id, email, password_hash, full_name, is_active,
            phone_number, gender, blood_type, date_of_birth, address,
            password_changed_at
        )
        VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
        RETURNING id
        "#
    )
    .bind(claims.hq_id)
    .bind(final_base_id)
    .bind(&payload.email)
    .bind(password_hash)
    .bind(&payload.full_name)
    .bind(&payload.phone_number)
    .bind(&payload.gender)
    .bind(&payload.blood_type)
    .bind(payload.date_of_birth)
    .bind(&payload.address)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create user: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let role_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM roles WHERE name_key = $1 AND hq_id = $2"
    )
    .bind(&final_role_key)
    .bind(claims.hq_id)
    .fetch_optional(&mut *tx)
    .await
    .unwrap_or(None);

    if let Some(rid) = role_id {
        sqlx::query("INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)")
            .bind(user_id)
            .bind(rid)
            .execute(&mut *tx)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    } else {
        tx.rollback().await.ok();
        return Err(StatusCode::BAD_REQUEST);
    }

    if final_role_key == "role.teacher" || final_role_key == "role.base.admin" {
        if let Some(bid) = final_base_id {
            sqlx::query(
                "INSERT INTO teachers (user_id, hq_id, base_id, is_active) VALUES ($1, $2, $3, true)"
            )
            .bind(user_id)
            .bind(claims.hq_id)
            .bind(bid)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                tracing::error!("Failed to create teacher profile: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
        }
    }

    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // ★★★ [修复 2] 这里构造 JSON 时补上 staff_status ★★★
    Ok(Json(UserDetail {
        id: user_id,
        email: payload.email,
        full_name: Some(payload.full_name),
        phone_number: payload.phone_number,
        gender: payload.gender,
        blood_type: payload.blood_type,
        date_of_birth: payload.date_of_birth,
        address: payload.address,
        is_active: true,
        
        staff_status: Some("active".to_string()), // 默认创建就是在职

        base_name: None, 
        base_id: final_base_id, 
        role_name: Some(final_role_key),
        created_at: chrono::Utc::now(),
        initial_password: Some(plain_password),
        skills: None, 
        is_teaching_now: Some(false),
    }))
}

// ... Update 相关的函数已经是对的，保持原样即可 ...
pub async fn update_user_status_handler(
    State(state): State<AppState>,
    claims: Claims,
    axum::extract::Path(user_id): axum::extract::Path<Uuid>,
    Json(payload): Json<UpdateStatusPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    
    let is_hq_admin = claims.roles.contains(&"role.hq.admin".to_string());
    let is_base_admin = claims.roles.contains(&"role.base.admin".to_string());

    if !is_hq_admin && !is_base_admin {
        return Err(StatusCode::FORBIDDEN);
    }

    let result = sqlx::query(
        "UPDATE users SET is_active = $1 WHERE id = $2 AND hq_id = $3"
    )
    .bind(payload.is_active)
    .bind(user_id)
    .bind(claims.hq_id)
    .execute(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update user status: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn update_user_handler(
    State(state): State<AppState>,
    claims: Claims,
    axum::extract::Path(user_id): axum::extract::Path<Uuid>,
    Json(payload): Json<UpdateUserPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    
    let mut tx = state.db_pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let new_is_active = if let Some(status) = &payload.staff_status {
        match status.as_str() {
            "resigned" => Some(false), 
            "active" => Some(true),    
            _ => None,                 
        }
    } else {
        None
    };

    if payload.full_name.is_some() || payload.phone_number.is_some() || payload.staff_status.is_some() {
        let _ = sqlx::query(
            r#"
            UPDATE users 
            SET 
                full_name = COALESCE($1, full_name),
                phone_number = COALESCE($2, phone_number),
                staff_status = COALESCE($3::staff_status, staff_status),
                is_active = COALESCE($4, is_active)
            WHERE id = $5 AND hq_id = $6
            "#
        )
        .bind(&payload.full_name)
        .bind(&payload.phone_number)
        .bind(&payload.staff_status)
        .bind(new_is_active)
        .bind(user_id)
        .bind(claims.hq_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Update user failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    }

    if let Some(new_role_key) = &payload.role_key {
        let role_id = sqlx::query_scalar::<_, Uuid>("SELECT id FROM roles WHERE name_key = $1")
            .bind(new_role_key)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::BAD_REQUEST)?;

        let result = sqlx::query("UPDATE user_roles SET role_id = $1 WHERE user_id = $2")
            .bind(role_id)
            .bind(user_id)
            .execute(&mut *tx)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            
        if result.rows_affected() == 0 {
             let _ = sqlx::query("INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)")
                .bind(user_id)
                .bind(role_id)
                .execute(&mut *tx)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        }
    }

    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({ "success": true })))
}