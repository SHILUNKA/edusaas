/*
 * src/handlers/membership.rs
 * 职责: 会员卡种 (MembershipTier) 管理 & 分配
 * (★ V16.2 - Fix: 补充缺失的 Path, UpdateStatusPayload 导入 ★)
 */

use axum::{
    extract::{Path, State}, // (★ 修复: 添加 Path)
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::{toggle_status_common, AppState};
use crate::models::{
    Claims,
    CreateCustomerMembershipPayload,
    CreateMembershipTierPayload,
    CustomerMembership,
    MembershipTier,
    UpdateStatusPayload, // (★ 修复: 添加 UpdateStatusPayload)
};

// (GET Tiers)
pub async fn get_membership_tiers_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<MembershipTier>>, StatusCode> {
    let tiers = sqlx::query_as::<_, MembershipTier>("SELECT * FROM membership_tiers WHERE tenant_id = $1 AND is_active = true ORDER BY price_in_cents ASC").bind(claims.tenant_id).fetch_all(&state.db_pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(tiers))
}

// (POST Tier)
pub async fn create_membership_tier_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateMembershipTierPayload>,
) -> Result<Json<MembershipTier>, StatusCode> {
    if !claims.roles.contains(&"role.tenant.admin".to_string()) {
        return Err(StatusCode::FORBIDDEN);
    }
    let price = (payload.price * 100.0).round() as i32;
    let new_tier = sqlx::query_as::<_, MembershipTier>(r#"INSERT INTO membership_tiers (tenant_id, name_key, description_key, tier_type, price_in_cents, duration_days, usage_count, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *"#)
    .bind(claims.tenant_id).bind(&payload.name_key).bind(payload.description_key).bind(payload.tier_type).bind(price).bind(payload.duration_days).bind(payload.usage_count).bind(payload.is_active.unwrap_or(true))
    .fetch_one(&state.db_pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(new_tier))
}

// (POST Assign - V15.0)
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
    let mut tx = match state.db_pool.begin().await {
        Ok(tx) => tx,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };
    let tier = match sqlx::query_as::<_, MembershipTier>(
        "SELECT * FROM membership_tiers WHERE id = $1 AND tenant_id = $2 AND is_active = true",
    )
    .bind(payload.tier_id)
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await
    {
        Ok(Some(t)) => t,
        Ok(None) => {
            tx.rollback().await.ok();
            return Err(StatusCode::NOT_FOUND);
        }
        Err(_) => {
            tx.rollback().await.ok();
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    let customer_check = sqlx::query("SELECT id FROM customers WHERE id = $1 AND tenant_id = $2")
        .bind(payload.customer_id)
        .bind(tenant_id)
        .fetch_optional(&mut *tx)
        .await;
    if customer_check.is_err() || customer_check.unwrap().is_none() {
        tx.rollback().await.ok();
        return Err(StatusCode::NOT_FOUND);
    }

    let start_date = Utc::now();
    let expiry_date = tier
        .duration_days
        .map(|d| start_date + chrono::Duration::days(d as i64));
    let new_membership = match sqlx::query_as::<_, CustomerMembership>(
        r#"INSERT INTO customer_memberships (tenant_id, customer_id, participant_id, tier_id, start_date, expiry_date, remaining_uses, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING *"#
    ).bind(tenant_id).bind(payload.customer_id).bind(payload.participant_id).bind(payload.tier_id).bind(start_date).bind(expiry_date).bind(tier.usage_count).fetch_one(&mut *tx).await {
        Ok(m) => m, Err(_) => { tx.rollback().await.ok(); return Err(StatusCode::INTERNAL_SERVER_ERROR); }
    };

    let price_in_cents = tier.price_in_cents;
    let user_id_uuid = Uuid::parse_str(&claims.sub).unwrap_or_default();
    sqlx::query(
        r#"INSERT INTO financial_transactions (tenant_id, base_id, amount_in_cents, transaction_type, category, related_entity_id, description, created_by, debit_subject, credit_subject) VALUES ($1, $2, $3, 'income', 'membership_sale', $4, $5, $6, 'cash', 'contract_liability')"#
    ).bind(tenant_id).bind(claims.base_id).bind(price_in_cents).bind(new_membership.id).bind(format!("销售会员卡: {}", tier.name_key)).bind(user_id_uuid).execute(&mut *tx).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Err(_) = tx.commit().await {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }
    Ok(Json(new_membership))
}

// (GET Base Memberships)
pub async fn get_base_memberships_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<CustomerMembership>>, StatusCode> {
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;
    let list = sqlx::query_as::<_, CustomerMembership>("SELECT cm.* FROM customer_memberships cm JOIN customers c ON cm.customer_id = c.id WHERE cm.tenant_id = $1 AND c.base_id = $2 AND cm.is_active = true ORDER BY cm.created_at DESC").bind(claims.tenant_id).bind(base_id).fetch_all(&state.db_pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(list))
}

// (GET Customer Memberships)
pub async fn get_customer_memberships_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(customer_id): Path<Uuid>,
) -> Result<Json<Vec<CustomerMembership>>, StatusCode> {
    let list = sqlx::query_as::<_, CustomerMembership>("SELECT * FROM customer_memberships WHERE customer_id = $1 AND tenant_id = $2 AND is_active = true").bind(customer_id).bind(claims.tenant_id).fetch_all(&state.db_pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(list))
}

// (PATCH Status)
pub async fn toggle_tier_status_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateStatusPayload>,
) -> Result<StatusCode, StatusCode> {
    if !claims.roles.contains(&"role.tenant.admin".to_string()) {
        return Err(StatusCode::FORBIDDEN);
    }
    toggle_status_common(
        &state.db_pool,
        "membership_tiers",
        id,
        claims.tenant_id,
        payload.is_active,
    )
    .await
}
