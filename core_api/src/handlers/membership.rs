/*
 * src/handlers/membership.rs
 * 职责: 会员卡种 (MembershipTier) 管理
 * (★ V4 - 已添加 API-J: 分配会员卡 ★)
 */

use axum::{extract::State, http::StatusCode, Json};
use chrono::{Utc, DateTime}; // <-- 【新增】

// 【修改】导入 AppState 和 Claims
use super::AppState;
use super::auth::Claims; // <-- 我们需要“钥匙”
// 导入 models
use crate::models::{
    MembershipTier, 
    CreateMembershipTierPayload,
    CustomerMembership, // <-- 【新增】
    CreateCustomerMembershipPayload, // <-- 【新增】
};


// (GET /api/v1/membership-tiers - "整数"版)
// (★ V2 - SaaS 安全加固 ★)
pub async fn get_membership_tiers(
    State(state): State<AppState>,
    claims: Claims, // <-- 【修改】必须出示“钥匙”
) -> Result<Json<Vec<MembershipTier>>, StatusCode> {

    let tenant_id = claims.tenant_id;

    let tiers = match sqlx::query_as::<_, MembershipTier>(
        r#"
        SELECT * FROM membership_tiers
        WHERE tenant_id = $1 AND is_active = true
        ORDER BY price_in_cents ASC
        "#,
    )
    .bind(tenant_id)
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(tiers) => tiers,
        Err(e) => {
            tracing::error!("Failed to fetch membership tiers: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(tiers))
}

// (POST /api/v1/membership-tiers - "整数"版)
// (★ V3 - 角色安全加固 ★)
pub async fn create_membership_tier(
    State(state): State<AppState>,
    claims: Claims, // <-- 【修改】必须出示“钥匙”
    Json(payload): Json<CreateMembershipTierPayload>,
) -> Result<Json<MembershipTier>, StatusCode> {

    // --- (★ 角色安全守卫 ★) ---
    let is_authorized = claims.roles.iter().any(|role| 
        role == "role.tenant.admin"
    );
    if !is_authorized {
        tracing::warn!(
            "Unauthorized attempt to create membership tier by user {} (roles: {:?})",
            claims.sub,
            claims.roles
        );
        return Err(StatusCode::FORBIDDEN); // 403 Forbidden
    }
    // --- (守卫结束) ---

    let tenant_id = claims.tenant_id;
    let price_in_cents = (payload.price * 100.0).round() as i32;

    let new_tier = match sqlx::query_as::<_, MembershipTier>(
        r#"
        INSERT INTO membership_tiers (
            tenant_id, name_key, description_key, tier_type, 
            price_in_cents, duration_days, usage_count, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(&payload.name_key)
    .bind(payload.description_key)
    .bind(payload.tier_type)
    .bind(price_in_cents)
    .bind(payload.duration_days)
    .bind(payload.usage_count)
    .bind(payload.is_active.unwrap_or(true))
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(tier) => tier,
        Err(e) => {
            tracing::error!("Failed to create membership tier: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(new_tier))
}

// --- 【新增】API-J: 为客户分配会员卡 (SaaS 强化版) ---

// (POST /api/v1/customer-memberships - 分配会员卡)
// (★ V2 - 基地安全加固 ★)
pub async fn assign_membership_handler(
    State(state): State<AppState>,
    claims: Claims, // <-- 【安全】自动验证 Token
    Json(payload): Json<CreateCustomerMembershipPayload>,
) -> Result<Json<CustomerMembership>, StatusCode> {

    let tenant_id = claims.tenant_id;

    // --- (★ 安全校验 1: 必须是基地员工) ---
    // 只有基地员工才能执行“售卡”操作
    let _base_id = match claims.base_id {
        Some(id) => id,
        None => {
            tracing::warn!(
                "Tenant admin (user {}) without base_id tried to assign membership",
                claims.sub
            );
            // 403 Forbidden: 总部管理员不允许此操作
            return Err(StatusCode::FORBIDDEN); 
        }
    };

    // --- (★ 关键: 启动数据库事务 ★) ---
    let mut tx = match state.db_pool.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!("Failed to start transaction: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // --- (★ 事务内: 安全校验 2: 校验 'tier_id') ---
    // (我们需要完整的 'tier' 对象来计算日期和次数)
    let tier = match sqlx::query_as::<_, MembershipTier>(
        "SELECT * FROM membership_tiers WHERE id = $1 AND tenant_id = $2 AND is_active = true"
    )
    .bind(payload.tier_id)
    .bind(tenant_id)
    .fetch_optional(&mut *tx) // (★ 关键: 使用事务 'tx')
    .await {
        Ok(Some(tier_data)) => tier_data,
        Ok(None) => {
            tracing::warn!("User {} tried to assign non-existent or cross-tenant tier_id {}", claims.sub, payload.tier_id);
            tx.rollback().await.ok();
            return Err(StatusCode::NOT_FOUND); // 404 Not Found: 卡种不存在
        },
        Err(e) => {
            tracing::error!("Failed to check tier: {}", e);
            tx.rollback().await.ok();
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // --- (★ 事务内: 安全校验 3: 校验 'customer_id') ---
    let customer_check = sqlx::query("SELECT id FROM customers WHERE id = $1 AND tenant_id = $2")
        .bind(payload.customer_id)
        .bind(tenant_id)
        .fetch_optional(&mut *tx)
        .await;

    if customer_check.is_err() || customer_check.unwrap().is_none() {
        tracing::warn!("User {} tried to assign to non-existent or cross-tenant customer_id {}", claims.sub, payload.customer_id);
        tx.rollback().await.ok();
        return Err(StatusCode::NOT_FOUND); // 404 Not Found: 客户不存在
    }

    // --- (★ 事务内: 安全校验 4: (可选) 校验 'participant_id') ---
    if let Some(participant_id) = payload.participant_id {
        let participant_check = sqlx::query(
            "SELECT id FROM participants WHERE id = $1 AND tenant_id = $2 AND customer_id = $3"
        )
        .bind(participant_id)
        .bind(tenant_id)
        .bind(payload.customer_id) // (★ 关键: 确保学员属于该家长)
        .fetch_optional(&mut *tx)
        .await;
        
        if participant_check.is_err() || participant_check.unwrap().is_none() {
            tracing::warn!("User {} tried to assign to non-existent or cross-customer participant_id {}", claims.sub, participant_id);
            tx.rollback().await.ok();
            return Err(StatusCode::NOT_FOUND); // 404 Not Found: 学员不存在(或不属于该家长)
        }
    }

    // --- (★ 事务内: 核心业务逻辑 ★) ---
    // (计算开始/结束日期 和 剩余次数)
    let start_date = Utc::now();
    
    let expiry_date: Option<DateTime<Utc>> = tier.duration_days.map(|days| 
        start_date + chrono::Duration::days(days as i64)
    );
    
    let remaining_uses: Option<i32> = tier.usage_count;

    // --- (★ 事务内: 核心操作: INSERT) ---
    let new_membership = match sqlx::query_as::<_, CustomerMembership>(
        r#"
        INSERT INTO customer_memberships
            (tenant_id, customer_id, participant_id, tier_id, 
             start_date, expiry_date, remaining_uses, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(payload.customer_id)
    .bind(payload.participant_id) // (可以是 None)
    .bind(payload.tier_id)
    .bind(start_date)
    .bind(expiry_date)
    .bind(remaining_uses)
    .fetch_one(&mut *tx) // (★ 关键: 使用事务 'tx')
    .await {
        Ok(membership) => membership,
        Err(e) => {
            tracing::error!("Failed to create customer membership: {}", e);
            tx.rollback().await.ok();
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    // --- (★ 关键: 提交事务 ★) ---
    if let Err(e) = tx.commit().await {
        tracing::error!("Failed to commit transaction: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // (事务成功)
    Ok(Json(new_membership))
}