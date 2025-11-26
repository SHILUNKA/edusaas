/*
 * src/handlers/user.rs
 * 职责: 员工与权限管理 (V5.0 - 安全增强版)
 */
use axum::{extract::State, http::StatusCode, Json};
use uuid::Uuid;
use bcrypt::{hash, DEFAULT_COST};
use crate::models::{UserDetail, CreateUserPayload};
use super::{AppState, auth::Claims};
use chrono::{DateTime, Utc};
use sqlx::FromRow;
// (★ 关键) 引入随机数生成
use rand::{Rng, seq::SliceRandom};

// --- 强密码生成工具函数 ---
fn generate_strong_password() -> String {
    let mut rng = rand::thread_rng();
    // 字符集定义
    let upper: Vec<char> = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".chars().collect();
    let lower: Vec<char> = "abcdefghijklmnopqrstuvwxyz".chars().collect();
    let numbers: Vec<char> = "0123456789".chars().collect();
    let special: Vec<char> = "!@#$%^&*".chars().collect();

    let mut password: Vec<char> = Vec::new();
    // 1. 保证每种类型至少有一个
    password.push(*upper.choose(&mut rng).unwrap());
    password.push(*lower.choose(&mut rng).unwrap());
    password.push(*numbers.choose(&mut rng).unwrap());
    password.push(*special.choose(&mut rng).unwrap());

    // 2. 填充剩余 4 位 (共 8 位)
    let all_chars = [upper, lower, numbers, special].concat();
    for _ in 0..4 {
        password.push(*all_chars.choose(&mut rng).unwrap());
    }

    // 3. 打乱顺序
    password.shuffle(&mut rng);
    password.into_iter().collect()
}

// (GET) 获取所有员工
pub async fn get_tenant_users(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<UserDetail>>, StatusCode> {
    let is_hq = claims.roles.iter().any(|r| r == "role.tenant.admin");
    if !is_hq {
        return Err(StatusCode::FORBIDDEN);
    }

    let users = match sqlx::query_as::<_, UserDetail>(
        r#"
        SELECT 
            u.id, u.email, u.full_name, u.is_active, u.created_at,
            u.phone_number, u.gender, u.blood_type, u.date_of_birth, u.address,
            b.name as base_name,
            (SELECT r.name_key FROM roles r 
             JOIN user_roles ur ON r.id = ur.role_id 
             WHERE ur.user_id = u.id LIMIT 1) as role_name
        FROM users u
        LEFT JOIN bases b ON u.base_id = b.id
        WHERE u.tenant_id = $1
        ORDER BY u.created_at DESC
        "#
    )
    .bind(claims.tenant_id)
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(users) => users,
        Err(e) => {
            tracing::error!("Failed to fetch users: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(users))
}

// (POST) 创建新员工
pub async fn create_tenant_user(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateUserPayload>,
) -> Result<Json<UserDetail>, StatusCode> {
    // 1. 权限检查
    let is_hq = claims.roles.iter().any(|r| r == "role.tenant.admin");
    if !is_hq {
        return Err(StatusCode::FORBIDDEN);
    }

    let mut tx = state.db_pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 2. (★ 核心) 自动生成强密码
    let plain_password = generate_strong_password();
    
    // 3. 哈希处理
    let password_hash = hash(&plain_password, DEFAULT_COST).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 4. 插入 User (包含详细档案 + 密码修改时间)
    let user_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO users (
            tenant_id, base_id, email, password_hash, full_name, is_active,
            phone_number, gender, blood_type, date_of_birth, address,
            password_changed_at -- (★ 记录当前时间)
        )
        VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
        RETURNING id
        "#
    )
    .bind(claims.tenant_id)
    .bind(payload.base_id)
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

    // 5. 分配角色
    let role_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM roles WHERE name_key = $1 AND tenant_id = $2"
    )
    .bind(&payload.role_key)
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

    // 6. (★ 业务联动) 如果是教师，自动创建档案
    if payload.role_key == "role.teacher" {
        if let Some(base_id) = payload.base_id {
            sqlx::query(
                r#"
                INSERT INTO teachers (user_id, tenant_id, base_id, is_active)
                VALUES ($1, $2, $3, true)
                "#
            )
            .bind(user_id)
            .bind(claims.tenant_id)
            .bind(base_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                tracing::error!("Failed to create teacher profile: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
        } else {
            tracing::warn!("Teacher creation failed: base_id is missing");
            tx.rollback().await.ok();
            return Err(StatusCode::BAD_REQUEST); 
        }
    }

    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 7. 返回数据 (包含明文密码)
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
        base_name: None,
        role_name: Some(payload.role_key),
        created_at: chrono::Utc::now(),
        // (★ 关键: 返回生成的密码)
        initial_password: Some(plain_password),
    }))
}