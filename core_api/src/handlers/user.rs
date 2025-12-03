/*
 * src/handlers/user.rs
 * 职责: 员工与权限管理
 * (★ V14.1 - 修复 UserDetail 初始化缺失 base_id ★)
 */
use axum::{extract::State, http::StatusCode, Json};
use uuid::Uuid;
use bcrypt::{hash, DEFAULT_COST};
use crate::models::{UserDetail, CreateUserPayload};
use super::{AppState, auth::Claims};

use sqlx::{QueryBuilder};
use rand::{seq::SliceRandom};

// --- 强密码生成工具函数 ---
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

// (GET) 获取员工列表 (含技能与实时状态 + base_id)
pub async fn get_tenant_users(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<UserDetail>>, StatusCode> {
    
    let tenant_id = claims.tenant_id;
    let is_hq = claims.roles.iter().any(|r| r == "role.tenant.admin");
    let is_base = claims.roles.iter().any(|r| r == "role.base.admin");

    if !is_hq && !is_base {
        return Err(StatusCode::FORBIDDEN);
    }

    // (★ V14.0 更新: 增加 u.base_id 查询)
    let mut query_builder: QueryBuilder<sqlx::Postgres> = QueryBuilder::new(
        r#"
        SELECT 
            u.id, u.email, u.full_name, u.is_active, u.created_at,
            u.phone_number, u.gender, u.blood_type, u.date_of_birth, u.address,
            u.base_id, -- (★ 关键: 必须查出来)
            b.name as base_name,
            (SELECT r.name_key FROM roles r 
             JOIN user_roles ur ON r.id = ur.role_id 
             WHERE ur.user_id = u.id LIMIT 1) as role_name,
             
            -- (1. 获取技能)
            (SELECT STRING_AGG(c.name_key, ', ')
             FROM teacher_qualified_courses tqc
             JOIN courses c ON tqc.course_id = c.id
             WHERE tqc.teacher_id = u.id) as skills,
             
            -- (2. 获取实时状态)
            EXISTS (
                SELECT 1 FROM classes cl
                JOIN class_teachers ct ON cl.id = ct.class_id
                WHERE ct.teacher_id = u.id
                AND cl.status = 'scheduled'
                AND CURRENT_TIMESTAMP BETWEEN cl.start_time AND cl.end_time
            ) as is_teaching_now

        FROM users u
        LEFT JOIN bases b ON u.base_id = b.id
        WHERE u.tenant_id = 
        "#
    );

    query_builder.push_bind(tenant_id);

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
pub async fn create_tenant_user(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateUserPayload>,
) -> Result<Json<UserDetail>, StatusCode> {
    
    let is_hq = claims.roles.iter().any(|r| r == "role.tenant.admin");
    let is_base = claims.roles.iter().any(|r| r == "role.base.admin");

    if !is_hq && !is_base {
        return Err(StatusCode::FORBIDDEN);
    }

    let (final_base_id, final_role_key) = if is_hq {
        (payload.base_id, payload.role_key)
    } else {
        let my_base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;
        (Some(my_base_id), "role.teacher".to_string())
    };

    let mut tx = state.db_pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let plain_password = generate_strong_password();
    let password_hash = hash(&plain_password, DEFAULT_COST).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO users (
            tenant_id, base_id, email, password_hash, full_name, is_active,
            phone_number, gender, blood_type, date_of_birth, address,
            password_changed_at
        )
        VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
        RETURNING id
        "#
    )
    .bind(claims.tenant_id)
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
        "SELECT id FROM roles WHERE name_key = $1 AND tenant_id = $2"
    )
    .bind(&final_role_key)
    .bind(claims.tenant_id)
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
                "INSERT INTO teachers (user_id, tenant_id, base_id, is_active) VALUES ($1, $2, $3, true)"
            )
            .bind(user_id)
            .bind(claims.tenant_id)
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
        base_name: None, // 刷新后会有
        // (★ 修复: 补上 base_id)
        base_id: final_base_id, 
        role_name: Some(final_role_key),
        created_at: chrono::Utc::now(),
        initial_password: Some(plain_password),
        skills: None, 
        is_teaching_now: Some(false),
    }))
}