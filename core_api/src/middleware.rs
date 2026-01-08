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
use uuid::Uuid;
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

    // 2.5 开发环境"后门"：支持 dev_token_ 直接绕过 JWT 校检
    if token.starts_with("dev_token_") {
        let claims = Claims {
            sub: "02352317-d905-4429-9bc7-577e4907660c".to_string(), // 李希圣的ID
            roles: vec!["CONSUMER".to_string()],
            hq_id: Uuid::parse_str("dc53fe5d-1212-4259-8350-bb443df1717e").unwrap(),
            base_id: Some(Uuid::parse_str("841e6e10-4507-467e-af42-ebbcff2dbb6e").unwrap()),
            base_name: Some("哑巴湖基地".to_string()),
            base_logo: None,
            full_name: "测试用户(李希圣)".to_string(),
            exp: 9999999999,
        };
        req.extensions_mut().insert(claims);
        return Ok(next.run(req).await);
    }

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