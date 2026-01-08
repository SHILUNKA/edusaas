/*
 * src/handlers/customer_auth.rs
 * 职责: C端微信登录与认证
 */

use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{Utc, Duration};
use jsonwebtoken::{encode, EncodingKey, Header};

use super::AppState;
use crate::models::Claims;

// ==========================================
// 请求/响应模型
// ==========================================

#[derive(Debug, Deserialize)]
pub struct WechatLoginPayload {
    pub code: String,           // 微信登录code
    pub base_id: Option<Uuid>,   // 从扫码参数获取 - 通过base_id可以查到hq_id
    pub encrypted_data: Option<String>,
    pub iv: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PhoneBindPayload {
    pub phone_number: String,
    pub code: String,           // 短信验证码（可选，或直接绑定）
}

#[derive(Debug, Serialize)]
pub struct WechatLoginResponse {
    pub token: String,
    pub customer: CustomerInfo,
    pub is_new_user: bool,      // 是否新用户
    pub needs_phone: bool,       // 是否需要绑定手机号
}

#[derive(Debug, Serialize)]
pub struct CustomerInfo {
    pub id: Uuid,
    pub name: Option<String>,
    pub phone_number: Option<String>,
    pub avatar_url: Option<String>,
    pub wechat_openid: String,
}

#[derive(Debug, Deserialize)]
pub struct MiniprogramCodePayload {
    pub base_id: Uuid,
    pub channel: Option<String>,  // 渠道标识
    pub page: Option<String>,      // 跳转页面
}

#[derive(Debug, Serialize)]
pub struct MiniprogramCodeResponse {
    pub qrcode_url: String,
    pub scene: String,            // 场景值
}

// ==========================================
// API Handlers
// ==========================================

// POST /api/v1/auth/wechat-login - 微信登录
pub async fn wechat_login_handler(
    State(state): State<AppState>,
    Json(payload): Json<WechatLoginPayload>,
) -> Result<Json<WechatLoginResponse>, StatusCode> {
    
    // TODO: 实际项目中需要调用微信API换取openid
    // 这里暂时模拟一个openid用于开发测试
    let wechat_openid = if payload.code == "test-code" {
        "test-openid-12345".to_string()
    } else {
        // 真实场景：调用微信API
        // let wx_response = get_wechat_openid(&payload.code).await?;
        // wx_response.openid
        format!("openid_{}", uuid::Uuid::new_v4().to_string())
    };

    // 查询是否已存在该openid的customer
    let existing_customer = sqlx::query_as::<_, CustomerRow>(
        r#"
        SELECT id, name, phone_number, avatar_url, wechat_openid, hq_id
        FROM customers 
        WHERE wechat_openid = $1
        "#,
    )
    .bind(&wechat_openid)
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to query customer: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let (customer_row, is_new_user) = match existing_customer {
        Some(customer) => (customer, false),
        None => {
            // 新用户：创建customer记录，关联到扫码的基地
            let base_id = payload.base_id.ok_or_else(|| {
                tracing::error!("Missing base_id in login payload for new customer");
                StatusCode::BAD_REQUEST
            })?;
            
            // 从base_id查询hq_id
            let base_info = sqlx::query!(
                "SELECT hq_id FROM bases WHERE id = $1",
                base_id
            )
            .fetch_one(&state.db_pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to query base info: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
            
            let new_customer = sqlx::query_as::<_, CustomerRow>(
                r#"
                INSERT INTO customers (wechat_openid, phone_number, hq_id, base_id)
                VALUES ($1, '', $2, $3)
                RETURNING id, name, phone_number, avatar_url, wechat_openid, hq_id
                "#,
            )
            .bind(&wechat_openid)
            .bind(base_info.hq_id)
            .bind(base_id)
            .fetch_one(&state.db_pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to create customer: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
            
            (new_customer, true)
        }
    };

    // 生成JWT Token
    let claims = Claims {
        sub: customer_row.id.to_string(),
        hq_id: customer_row.hq_id.unwrap_or(Uuid::nil()),
        base_id: None,
        roles: vec!["customer".to_string()],
        exp: (Utc::now() + Duration::days(30)).timestamp() as usize,
        base_name: None,
        base_logo: None,
        full_name: customer_row.name.clone().unwrap_or_default(),
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.jwt_secret.as_bytes()),
    )
    .map_err(|e| {
        tracing::error!("Failed to generate token: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(WechatLoginResponse {
        token,
        customer: CustomerInfo {
            id: customer_row.id,
            name: customer_row.name.clone(),
            phone_number: customer_row.phone_number.clone(),
            avatar_url: customer_row.avatar_url,
            wechat_openid,
        },
        is_new_user,
        needs_phone: customer_row.phone_number.as_ref().map(|p| p.is_empty()).unwrap_or(true),
    }))
}

// POST /api/v1/customer/bind-phone - 绑定手机号
pub async fn bind_phone_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<PhoneBindPayload>,
) -> Result<StatusCode, StatusCode> {
    
    let customer_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    // TODO: 验证短信验证码
    // verify_sms_code(&payload.phone_number, &payload.code)?;

    // 更新手机号
    sqlx::query(
        "UPDATE customers SET phone_number = $1 WHERE id = $2"
    )
    .bind(&payload.phone_number)
    .bind(customer_id)
    .execute(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to bind phone: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(StatusCode::OK)
}

// POST /api/v1/base/generate-miniprogram-code - 生成小程序码
pub async fn generate_miniprogram_code_handler(
    State(_state): State<AppState>,
    Json(payload): Json<MiniprogramCodePayload>,
) -> Result<Json<MiniprogramCodeResponse>, StatusCode> {
    
    // 构造场景值（最多32个字符）
    let scene = format!(
        "b_{}_c_{}",
        payload.base_id.to_string().split('-').next().unwrap_or(""),
        payload.channel.unwrap_or_else(|| "default".to_string())
    );

    // TODO: 调用微信API生成小程序码
    // 真实场景需要：
    // 1. 获取access_token
    // 2. 调用微信 getwxacodeunlimit 接口
    // 3. 保存返回的图片到OSS
    // 4. 返回图片URL

    // 暂时返回模拟数据
    Ok(Json(MiniprogramCodeResponse {
        qrcode_url: format!("https://example.com/qrcode/{}.jpg", scene),
        scene,
    }))
}

// ==========================================
// 数据库辅助结构
// ==========================================

#[derive(Debug, sqlx::FromRow)]
struct CustomerRow {
    id: Uuid,
    name: Option<String>,
    phone_number: Option<String>,
    avatar_url: Option<String>,
    wechat_openid: String,
    hq_id: Option<Uuid>,
}
