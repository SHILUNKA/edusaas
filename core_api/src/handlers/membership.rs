/*
 * src/handlers/membership.rs
 * 职责: 会员卡种 (MembershipTier) 管理 & 分配
 * (★ V15.1 - 修复 Uuid 导入错误 ★)
 */

use axum::{extract::State, http::StatusCode, Json};
use chrono::{Utc, DateTime};
use uuid::Uuid; // (★ 修复: 添加这行导入)

use super::AppState;
use super::auth::Claims; 
use crate::models::{
    MembershipTier, 
    CreateMembershipTierPayload,
    CustomerMembership, 
    CreateCustomerMembershipPayload,
};

// (GET /api/v1/membership-tiers)
pub async fn get_membership_tiers_handler(
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
pub async fn create_membership_tier_handler(
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

// --- API-J: 为客户分配会员卡 (含自动记账) ---

// (POST /api/v1/customer-memberships)
pub async fn assign_membership_handler(
    State(state): State<AppState>,
    claims: Claims, 
    Json(payload): Json<CreateCustomerMembershipPayload>,
) -> Result<Json<CustomerMembership>, StatusCode> {

    let tenant_id = claims.tenant_id;

    // 1. 安全校验: 必须是基地员工
    let _base_id = match claims.base_id {
        Some(id) => id,
        None => {
            tracing::warn!("Tenant admin tried to assign membership without base_id");
            return Err(StatusCode::FORBIDDEN); 
        }
    };

    let mut tx = match state.db_pool.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!("Failed to start transaction: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // 2. 校验卡种
    let tier = match sqlx::query_as::<_, MembershipTier>(
        "SELECT * FROM membership_tiers WHERE id = $1 AND tenant_id = $2 AND is_active = true"
    )
    .bind(payload.tier_id)
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await {
        Ok(Some(tier_data)) => tier_data,
        Ok(None) => {
            tx.rollback().await.ok();
            return Err(StatusCode::NOT_FOUND);
        },
        Err(_) => {
            tx.rollback().await.ok();
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // 3. 校验客户
    let customer_check = sqlx::query("SELECT id FROM customers WHERE id = $1 AND tenant_id = $2")
        .bind(payload.customer_id)
        .bind(tenant_id)
        .fetch_optional(&mut *tx)
        .await;

    if customer_check.is_err() || customer_check.unwrap().is_none() {
        tx.rollback().await.ok();
        return Err(StatusCode::NOT_FOUND); 
    }

    // 4. 核心业务: 创建会员卡记录
    let start_date = Utc::now();
    let expiry_date: Option<DateTime<Utc>> = tier.duration_days.map(|days| 
        start_date + chrono::Duration::days(days as i64)
    );
    let remaining_uses: Option<i32> = tier.usage_count;

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
        Ok(membership) => membership,
        Err(e) => {
            tracing::error!("Failed to create customer membership: {}", e);
            tx.rollback().await.ok();
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    // --- (★ V15.0 核心: 自动财务记账) ---
    let price_in_cents = tier.price_in_cents;
    let user_id_uuid = Uuid::parse_str(&claims.sub).unwrap_or_default(); // (★ 现在 Uuid 已导入)
    
    // 记录收入: 借-Cash, 贷-ContractLiability
    sqlx::query(
        r#"
        INSERT INTO financial_transactions 
        (tenant_id, base_id, amount_in_cents, transaction_type, category, related_entity_id, description, created_by, debit_subject, credit_subject)
        VALUES ($1, $2, $3, 'income', 'membership_sale', $4, $5, $6, 'cash', 'contract_liability')
        "#
    )
    .bind(tenant_id)
    .bind(claims.base_id) // 收入归属当前操作人所在的基地
    .bind(price_in_cents) // 正数
    .bind(new_membership.id) // 关联会员卡ID
    .bind(format!("销售会员卡: {}", tier.name_key))
    .bind(user_id_uuid)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create financial record: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    // --- (记账结束) ---

    if let Err(e) = tx.commit().await {
        tracing::error!("Failed to commit transaction: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    Ok(Json(new_membership))
}

// (★ V5.0 新增: 获取本基地所有有效会员卡)
pub async fn get_base_memberships_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<CustomerMembership>>, StatusCode> {
    let tenant_id = claims.tenant_id;
    let base_id = match claims.base_id {
        Some(id) => id,
        None => return Err(StatusCode::FORBIDDEN), 
    };

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

// (GET /api/v1/customers/:id/memberships)
pub async fn get_customer_memberships_handler(
    State(state): State<AppState>,
    claims: Claims,
    axum::extract::Path(customer_id): axum::extract::Path<Uuid>,
) -> Result<Json<Vec<CustomerMembership>>, StatusCode> {
    let tenant_id = claims.tenant_id;
    
    let memberships = sqlx::query_as::<_, CustomerMembership>(
        "SELECT * FROM customer_memberships WHERE customer_id = $1 AND tenant_id = $2 AND is_active = true"
    )
    .bind(customer_id)
    .bind(tenant_id)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(memberships))
}