/*
 * core_api/src/handlers/auth.rs
 * (★ V21.2 - 修复版: 修复 bcrypt 闭包类型推断错误 ★)
 */
use axum::{
    extract::{State},
    http::{StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use sqlx::{Row};
use uuid::Uuid;
use bcrypt::{hash, verify, DEFAULT_COST}; // 确保引入 hash 和 verify
use jsonwebtoken::{encode, Header, EncodingKey};
use chrono::{Utc, Duration};
use tokio::task; 

use super::AppState;
use crate::models::{Claims, User, AuthBody, AuthResponse}; 

// 错误处理 (保留)
#[derive(Debug)]
pub enum CustomAuthError {
    TokenMissing,
    TokenInvalid,
    InternalError,
}

impl IntoResponse for CustomAuthError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            CustomAuthError::TokenMissing => (StatusCode::UNAUTHORIZED, "Missing authorization token"),
            CustomAuthError::TokenInvalid => (StatusCode::UNAUTHORIZED, "Invalid authorization token"),
            CustomAuthError::InternalError => (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error"),
        };
        (status, Json(serde_json::json!({"error": error_message}))).into_response()
    }
}

pub async fn register_handler(
    State(state): State<AppState>,
    Json(payload): Json<AuthBody>,
) -> Result<Json<User>, StatusCode> {
    
    // 1. 获取租户ID (取第一个作为默认)
    let hq_id = match sqlx::query_scalar::<_, Uuid>("SELECT id FROM hqs LIMIT 1")
        .fetch_one(&state.db_pool)
        .await {
        Ok(id) => id,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    // 2. 密码加密 (修复类型推断)
    let password_to_hash = payload.password.clone();
    
    // 我们显式指定闭包的返回类型，帮助编译器推断
    let password_hash = task::spawn_blocking(move || -> Result<String, bcrypt::BcryptError> {
        hash(&password_to_hash, DEFAULT_COST)
    })
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)? // JoinError
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?; // BcryptError

    // 3. 插入数据库 (★ 关键修复: NULL as role_name ★)
    let new_user = match sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (hq_id, email, password_hash, full_name, staff_status)
        VALUES ($1, $2, $3, 'New User', 'active') 
        RETURNING 
            id, email, full_name, hq_id, base_id, is_active, 
            created_at, phone_number, 
            staff_status::TEXT, -- ★★★ 修复点：强制转换为 TEXT 类型 ★★★
            NULL as role_name
        "#,
    )
    .bind(hq_id)
    .bind(&payload.email)
    .bind(password_hash)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(user) => user,
        Err(e) => {
            tracing::error!("Register DB Error: {:?}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        },
    };

    Ok(Json(new_user))
}

pub async fn login_handler(
    State(state): State<AppState>,
    Json(payload): Json<AuthBody>,
) -> Result<Json<AuthResponse>, StatusCode> {
    
    // 1. 查询用户
    let user_query = sqlx::query(
        r#"
        SELECT 
            u.id, u.password_hash, u.hq_id, u.base_id, u.is_active, u.password_changed_at,
            b.name as base_name, b.logo_url as base_logo
        FROM users u
        LEFT JOIN bases b ON u.base_id = b.id
        WHERE u.email = $1
        "#
    )
    .bind(&payload.email)
    .fetch_optional(&state.db_pool)
    .await;

    let user_row = match user_query {
        Ok(Some(row)) => row,
        Ok(None) => return Err(StatusCode::UNAUTHORIZED),
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let user_id: Uuid = user_row.get("id");
    let password_hash: String = user_row.get("password_hash");
    let hq_id: Uuid = user_row.get("hq_id");
    let base_id: Option<Uuid> = user_row.get("base_id");
    let is_active: bool = user_row.get("is_active");
    let base_name: Option<String> = user_row.get("base_name");
    let base_logo: Option<String> = user_row.get("base_logo");

    // 2. 验证密码 (bcrypt) - 修复类型推断
    let password_to_verify = payload.password.clone();
    let stored_hash = password_hash.clone(); // 克隆一份给闭包使用

    // 同样显式指定返回类型
    let valid_password = task::spawn_blocking(move || -> Result<bool, bcrypt::BcryptError> {
        verify(&password_to_verify, &stored_hash)
    })
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)? // JoinError
    .unwrap_or(false); // BcryptError -> treat as false (invalid password)

    if !valid_password || !is_active {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // 3. 获取角色
    let roles: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT r.name_key
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = $1
        "#
    )
    .bind(user_id)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 4. 生成 Token
    let claims = Claims {
        sub: user_id.to_string(),
        hq_id,
        base_id,
        roles,
        base_name, 
        base_logo,
        exp: (Utc::now() + Duration::days(1)).timestamp() as usize,
    };

    let token = encode(
        &Header::default(), 
        &claims, 
        &EncodingKey::from_secret(state.jwt_secret.as_ref())
    )
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 5. 记录日志
    let _ = sqlx::query(
        r#"INSERT INTO user_login_history (email_attempted, user_id, hq_id, status) VALUES ($1, $2, $3, 'success')"#
    )
    .bind(&payload.email)
    .bind(user_id)
    .bind(hq_id)
    .execute(&state.db_pool).await;

    Ok(Json(AuthResponse { token }))
}