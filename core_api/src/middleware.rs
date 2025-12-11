/*
 * src/middleware.rs
 * 职责: 拦截所有请求，校验 JWT Token，并将用户信息注入到请求上下文中
 */
use axum::{
    extract::Request,
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use crate::models::Claims;

pub async fn auth_middleware(
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // 1. 获取 Authorization Header
    let auth_header = req.headers()
        .get(header::AUTHORIZATION)
        .and_then(|header| header.to_str().ok());

    let auth_header = if let Some(auth_header) = auth_header {
        auth_header
    } else {
        return Err(StatusCode::UNAUTHORIZED);
    };

    // 2. 检查 "Bearer " 前缀
    if !auth_header.starts_with("Bearer ") {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let token = &auth_header[7..];

    // 3. 解析 Token
    let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());
    
    // 如果你的 Token 没有设置 exp 过期时间，可以把 validate_exp 设为 false，但在生产环境建议开启
    let mut validation = Validation::default();
    validation.validate_exp = true; 

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    ).map_err(|_| StatusCode::UNAUTHORIZED)?; // Token 过期或无效

    // 4. 将 Claims 放入请求扩展中 (Extensions)
    // 这一步至关重要，后续的 Handler 通过 Claims::from_request_parts 获取数据
    req.extensions_mut().insert(token_data.claims);

    // 5. 放行
    Ok(next.run(req).await)
}