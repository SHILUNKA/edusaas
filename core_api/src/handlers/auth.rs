/*
 * src/handlers/auth.rs
 * 职责: 登录, 注册, 和 Token (Claims) 提取。
 * (★ V2 - 已使用 spawn_blocking 修复阻塞 Bug ★)
 */

use axum::{
    extract::{FromRequestParts, State, FromRef},
    http::{StatusCode, request::Parts},
    response::{IntoResponse, Response},
    Json,
    async_trait,
};
use sqlx::{PgPool, FromRow, Row};
use uuid::Uuid;
use bcrypt::{hash, verify, DEFAULT_COST, BcryptError};
use jsonwebtoken::{encode, decode, Header, EncodingKey, Validation, DecodingKey};
use serde::{Deserialize, Serialize};
use chrono::{Utc, Duration};
use tokio::task; // (★ 关键)

// 导入在 mod.rs 中定义的 AppState
use super::AppState;

// Token Claims
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub roles: Vec<String>,
    pub tenant_id: Uuid,
    pub base_id: Option<Uuid>,
    pub exp: usize,
}

// 自定义认证错误
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

// Token 提取器
#[async_trait]
impl<S> FromRequestParts<S> for Claims
where
    S: Send + Sync,
    AppState: FromRef<S>,
{
    type Rejection = CustomAuthError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let app_state = AppState::from_ref(state);
        let jwt_secret = app_state.jwt_secret.as_bytes();
        let decoding_key = DecodingKey::from_secret(jwt_secret);

        let headers = parts.headers
            .get("Authorization")
            .ok_or(CustomAuthError::TokenMissing)?;
        
        let auth_header = headers.to_str()
            .map_err(|_| CustomAuthError::TokenInvalid)?;
        
        let token = auth_header.strip_prefix("Bearer ")
            .ok_or(CustomAuthError::TokenInvalid)?;

        let validation = Validation::default();
        let token_data = decode::<Claims>(token, &decoding_key, &validation)
            .map_err(|e| {
                tracing::warn!("Token validation failed: {}", e);
                CustomAuthError::TokenInvalid
            })?;

        Ok(token_data.claims)
    }
}

// Auth JSON Body
#[derive(Debug, Deserialize)]
pub struct AuthBody {
    email: String,
    password: String,
}

// Auth JSON Response
#[derive(Debug, Serialize)]
pub struct AuthResponse {
    token: String,
}

// (Temporary) Register Response
#[derive(Debug, Serialize, FromRow)]
pub struct User { 
    id: Uuid,
    email: String,
    tenant_id: Uuid,
}

// (Temporary register API)
// (★ V2 - 修复 bcrypt 阻塞 ★)
pub async fn register_handler(
    State(state): State<AppState>,
    Json(payload): Json<AuthBody>,
) -> Result<Json<User>, StatusCode> {
    
    let tenant_id = match sqlx::query_scalar::<_, Uuid>("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&state.db_pool)
        .await {
        Ok(id) => id,
        Err(_e) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    // --- (★ 关键修复: 异步执行 CPU 密集型 HASH 操作) ---
    let password_to_hash = payload.password.clone();
    let password_hash = task::spawn_blocking(move || {
        hash(&password_to_hash, DEFAULT_COST)
    })
    .await
    .map_err(|e| {
        // (JoinError)
        tracing::error!("Failed to join hash task: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .map_err(|e: BcryptError| {
        // (BcryptError)
        tracing::error!("Failed to hash password: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    // --- (修复结束) ---

    let new_user = match sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (tenant_id, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, email, tenant_id
        "#,
    )
    .bind(tenant_id)
    .bind(&payload.email)
    .bind(password_hash)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(user) => user,
        Err(e) => {
            if let Some(db_err) = e.as_database_error() {
                if db_err.constraint() == Some("users_email_key") {
                    tracing::warn!("Failed to create user, email already exists: {}", payload.email);
                    return Err(StatusCode::CONFLICT);
                }
            }
            tracing::error!("Failed to create user: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(new_user))
}

// (SaaS 强化的 login_handler)
// (★ V2 - 修复 bcrypt 阻塞 ★)
pub async fn login_handler(
    State(state): State<AppState>,
    Json(payload): Json<AuthBody>,
) -> Result<Json<AuthResponse>, StatusCode> {
    
    let user_query = sqlx::query(
        "SELECT id, password_hash, tenant_id, base_id, is_active FROM users WHERE email = $1"
    )
    .bind(&payload.email)
    .fetch_optional(&state.db_pool)
    .await;

    tracing::info!("登录请求: email={}", payload.email);

    let user_row = match user_query {
        Ok(Some(row)) => row,
        Ok(None) => {
            tracing::warn!("Login attempt failed (user not found): {}", payload.email);
            let _ = sqlx::query(r#"INSERT INTO user_login_history (email_attempted, status, failure_reason_key) VALUES ($1, 'failed', 'auth.error.user_not_found')"#)
                .bind(&payload.email)
                .execute(&state.db_pool).await;
            return Err(StatusCode::UNAUTHORIZED);
        },
        Err(e) => {
            tracing::error!("DB error during login: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let user_id: Uuid = user_row.get("id");
    let password_hash: String = user_row.get("password_hash");
    let tenant_id: Uuid = user_row.get("tenant_id");
    let base_id: Option<Uuid> = user_row.get("base_id");
    let is_active: bool = user_row.get("is_active");

    // --- (★ 关键修复: 异步执行 CPU 密集型 VERIFY 操作) ---
    let password_to_verify = payload.password.clone();
    let valid_password = task::spawn_blocking(move || {
        verify(&password_to_verify, &password_hash)
    })
    .await
    .map_err(|e| {
        // (JoinError)
        tracing::error!("Failed to join verify task: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .unwrap_or(false);
    // --- (修复结束) ---

    if !valid_password {
        tracing::warn!("Login attempt failed (wrong password): {}", payload.email);
        let _ = sqlx::query(r#"INSERT INTO user_login_history (email_attempted, user_id, tenant_id, status, failure_reason_key) VALUES ($1, $2, $3, 'failed', 'auth.error.wrong_password')"#)
            .bind(&payload.email).bind(user_id).bind(tenant_id)
            .execute(&state.db_pool).await;
        return Err(StatusCode::UNAUTHORIZED);
    }

    if !is_active {
        tracing::warn!("Login attempt failed (account inactive): {}", payload.email);
        let _ = sqlx::query(r#"INSERT INTO user_login_history (email_attempted, user_id, tenant_id, status, failure_reason_key) VALUES ($1, $2, $3, 'failed', 'auth.error.inactive_account')"#)
            .bind(&payload.email).bind(user_id).bind(tenant_id)
            .execute(&state.db_pool).await;
        return Err(StatusCode::FORBIDDEN);
    }

    let roles: Vec<String> = match sqlx::query_scalar(
        r#"
        SELECT r.name_key 
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = $1 AND r.tenant_id = $2
        "#
    )
    .bind(user_id)
    .bind(tenant_id)
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(roles_vec) => roles_vec,
        Err(e) => {
            tracing::error!("Failed to fetch roles for user {}: {}", user_id, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    let now = Utc::now();
    let expires_in = Duration::days(1);
    let exp = (now + expires_in).timestamp() as usize;
    let claims = Claims {
        sub: user_id.to_string(),
        tenant_id: tenant_id,
        base_id: base_id,
        roles: roles,
        exp,
    };
    let token = match encode(
        &Header::default(), 
        &claims, 
        &EncodingKey::from_secret(state.jwt_secret.as_ref())
    ) {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("Failed to create token: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    let _ = sqlx::query(
        r#"INSERT INTO user_login_history (email_attempted, user_id, tenant_id, status) VALUES ($1, $2, $3, 'success')"#
    )
    .bind(&payload.email)
    .bind(user_id)
    .bind(tenant_id)
    .execute(&state.db_pool).await;

    Ok(Json(AuthResponse { token }))
}