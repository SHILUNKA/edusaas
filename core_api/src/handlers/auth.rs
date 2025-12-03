/*
 * src/handlers/auth.rs
 * 职责: 登录认证 (V3.0 - 包含密码过期检查)
 */
use axum::{
    extract::{FromRequestParts, State, FromRef},
    http::{StatusCode, request::Parts},
    response::{IntoResponse, Response},
    Json,
    async_trait,
};
use sqlx::{FromRow, Row};
use uuid::Uuid;
use bcrypt::{hash, verify, DEFAULT_COST};
use jsonwebtoken::{encode, decode, Header, EncodingKey, Validation, DecodingKey};
use serde::{Deserialize, Serialize};
use chrono::{Utc, Duration, DateTime};
use tokio::task; 

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

#[derive(Debug, Deserialize)]
pub struct AuthBody {
    email: String,
    password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    token: String,
}

#[derive(Debug, Serialize, FromRow)]
pub struct User { 
    id: Uuid,
    email: String,
    tenant_id: Uuid,
}

// (注册接口 - 保持原样，仅用于初始化)
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

    let password_to_hash = payload.password.clone();
    let password_hash = task::spawn_blocking(move || {
        hash(&password_to_hash, DEFAULT_COST)
    })
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

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
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    Ok(Json(new_user))
}

// (登录接口 - 增强版)
pub async fn login_handler(
    State(state): State<AppState>,
    Json(payload): Json<AuthBody>,
) -> Result<Json<AuthResponse>, StatusCode> {
    
    // 1. 查询用户 (包含密码修改时间)
    let user_query = sqlx::query(
        r#"
        SELECT id, password_hash, tenant_id, base_id, is_active, password_changed_at 
        FROM users WHERE email = $1
        "#
    )
    .bind(&payload.email)
    .fetch_optional(&state.db_pool)
    .await;

    tracing::info!("登录请求: email={}", payload.email);

    let user_row = match user_query {
        Ok(Some(row)) => row,
        Ok(None) => {
            tracing::warn!("Login attempt failed (user not found): {}", payload.email);
            return Err(StatusCode::UNAUTHORIZED);
        },
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let user_id: Uuid = user_row.get("id");
    let password_hash: String = user_row.get("password_hash");
    let tenant_id: Uuid = user_row.get("tenant_id");
    let base_id: Option<Uuid> = user_row.get("base_id");
    let is_active: bool = user_row.get("is_active");
    let password_changed_at: Option<DateTime<Utc>> = user_row.get("password_changed_at");

    // 2. 验证密码 (异步)
    let password_to_verify = payload.password.clone();
    let valid_password = task::spawn_blocking(move || {
        verify(&password_to_verify, &password_hash)
    })
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .unwrap_or(false);

    if !valid_password {
        tracing::warn!("Login failed (wrong password): {}", payload.email);
        return Err(StatusCode::UNAUTHORIZED);
    }

    if !is_active {
        tracing::warn!("Login failed (inactive): {}", payload.email);
        return Err(StatusCode::FORBIDDEN);
    }

    // 3. (★ 新增) 检查密码有效期 (180天)
    if let Some(changed_at) = password_changed_at {
        let days_since_change = (Utc::now() - changed_at).num_days();
        if days_since_change > 180 {
            tracing::warn!("Login failed: password expired for {} ({} days)", payload.email, days_since_change);
            // 这里返回 FORBIDDEN，前端可以据此提示联系管理员
            return Err(StatusCode::FORBIDDEN); 
        }
    }

    // 4. 获取角色并生成 Token
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
        Ok(r) => r,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let now = Utc::now();
    let expires_in = Duration::days(1);
    let exp = (now + expires_in).timestamp() as usize;
    let claims = Claims {
        sub: user_id.to_string(),
        tenant_id,
        base_id,
        roles,
        exp,
    };
    
    let token = match encode(
        &Header::default(), 
        &claims, 
        &EncodingKey::from_secret(state.jwt_secret.as_ref())
    ) {
        Ok(t) => t,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    // 记录成功日志
    let _ = sqlx::query(
        r#"INSERT INTO user_login_history (email_attempted, user_id, tenant_id, status) VALUES ($1, $2, $3, 'success')"#
    )
    .bind(&payload.email)
    .bind(user_id)
    .bind(tenant_id)
    .execute(&state.db_pool).await;

    Ok(Json(AuthResponse { token }))
}