/*
 * src/handlers/membership.rs
 * 职责: 会员卡种 (MembershipTier) 管理
 * (★ V5.0 - 补全查询接口 & 修复命名 ★)
 */

use axum::{extract::{State, Path}, http::StatusCode, Json}; // (★ 修改: 引入 Path)
use chrono::{Utc, DateTime};

use super::AppState;
use super::auth::Claims; 
use crate::models::{
    MembershipTier, 
    CreateMembershipTierPayload,
    CustomerMembership, 
    CreateCustomerMembershipPayload,
};


// (GET /api/v1/membership-tiers)
pub async fn get_membership_tiers_handler( // (★ 确认后缀)
    State(state): State<AppState>,
    claims: Claims, 
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

// (POST /api/v1/membership-tiers)
pub async fn create_membership_tier_handler( // (★ 确认后缀)
    State(state): State<AppState>,
    claims: Claims, 
    Json(payload): Json<CreateMembershipTierPayload>,
) -> Result<Json<MembershipTier>, StatusCode> {

    let is_authorized = claims.roles.iter().any(|role| 
        role == "role.tenant.admin"
    );
    if !is_authorized {
        return Err(StatusCode::FORBIDDEN); 
    }

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

// (POST /api/v1/customer-memberships - 分配会员卡)
pub async fn assign_membership_handler(
    State(state): State<AppState>,
    claims: Claims, 
    Json(payload): Json<CreateCustomerMembershipPayload>,
) -> Result<Json<CustomerMembership>, StatusCode> {

    let tenant_id = claims.tenant_id;

    let _base_id = match claims.base_id {
        Some(id) => id,
        None => return Err(StatusCode::FORBIDDEN), 
    };

    let mut tx = state.db_pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 1. 校验 tier
    let tier = match sqlx::query_as::<_, MembershipTier>(
        "SELECT * FROM membership_tiers WHERE id = $1 AND tenant_id = $2 AND is_active = true"
    )
    .bind(payload.tier_id)
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await {
        Ok(Some(t)) => t,
        Ok(None) => {
            tx.rollback().await.ok();
            return Err(StatusCode::NOT_FOUND);
        },
        Err(_) => {
            tx.rollback().await.ok();
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // 2. 校验 customer
    let customer_check = sqlx::query("SELECT id FROM customers WHERE id = $1 AND tenant_id = $2")
        .bind(payload.customer_id)
        .bind(tenant_id)
        .fetch_optional(&mut *tx)
        .await;

    if customer_check.is_err() || customer_check.unwrap().is_none() {
        tx.rollback().await.ok();
        return Err(StatusCode::NOT_FOUND);
    }

    // 3. 计算有效期
    let start_date = Utc::now();
    let expiry_date = tier.duration_days.map(|days| start_date + chrono::Duration::days(days as i64));
    let remaining_uses = tier.usage_count;

    // 4. 插入
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
    .bind(payload.participant_id)
    .bind(payload.tier_id)
    .bind(start_date)
    .bind(expiry_date)
    .bind(remaining_uses)
    .fetch_one(&mut *tx) 
    .await {
        Ok(m) => m,
        Err(e) => {
            tracing::error!("Failed to assign membership: {}", e);
            tx.rollback().await.ok();
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(new_membership))
}

// --- (★ 新增: 修复缺失的 Handler) ---
// (GET /api/v1/customers/:id/memberships)
pub async fn get_customer_memberships_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(customer_id): Path<uuid::Uuid>,
) -> Result<Json<Vec<CustomerMembership>>, StatusCode> {
    
    let tenant_id = claims.tenant_id;

    // 简单的租户校验
    let memberships = match sqlx::query_as::<_, CustomerMembership>(
        r#"
        SELECT * FROM customer_memberships 
        WHERE customer_id = $1 AND tenant_id = $2
        ORDER BY created_at DESC
        "#
    )
    .bind(customer_id)
    .bind(tenant_id)
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(list) => list,
        Err(e) => {
            tracing::error!("Failed to fetch customer memberships: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(memberships))
}

// --- (★ 新增) 获取本基地所有有效的会员卡 (用于 CRM 列表展示) ---
// (GET /api/v1/base/customer-memberships)
pub async fn get_base_memberships_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<CustomerMembership>>, StatusCode> {
    
    let tenant_id = claims.tenant_id;

    // 1. 必须是基地员工
    let base_id = match claims.base_id {
        Some(id) => id,
        None => return Err(StatusCode::FORBIDDEN), 
    };

    // 2. 查询本基地所有家长的有效会员卡
    // (通过 JOIN customers 表来过滤 base_id)
    let memberships = match sqlx::query_as::<_, CustomerMembership>(
        r#"
        SELECT cm.* FROM customer_memberships cm
        JOIN customers c ON cm.customer_id = c.id
        WHERE cm.tenant_id = $1 
          AND c.base_id = $2 
          AND cm.is_active = true
        ORDER BY cm.created_at DESC
        "#
    )
    .bind(tenant_id)
    .bind(base_id)
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(list) => list,
        Err(e) => {
            tracing::error!("Failed to fetch base memberships: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(memberships))
}