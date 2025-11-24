/*
 * src/handlers/honor.rs
 * 职责: 荣誉/等级 (HonorRank) 管理
 * (★ V3 - 角色安全加固版 ★)
 */

use axum::{extract::State, http::StatusCode, Json};


// 【修改】导入 AppState 和 Claims
use super::AppState;
use super::auth::Claims; // <-- 我们需要“钥匙”
// 导入 models
use crate::models::{HonorRank, CreateHonorRankPayload};


// (GET /api/v1/honor-ranks)
// (★ V2 - SaaS 安全加固 ★)
pub async fn get_honor_ranks(
    State(state): State<AppState>,
    claims: Claims, // <-- 【修改】必须出示“钥匙”
) -> Result<Json<Vec<HonorRank>>, StatusCode> {
    
    // (HACK 已移除!)
    let tenant_id = claims.tenant_id; // <-- 【修改】使用“钥匙”中的租户ID

    let ranks = match sqlx::query_as::<_, HonorRank>(
        r#"
        SELECT * FROM honor_ranks
        WHERE tenant_id = $1
        ORDER BY rank_level ASC
        "#,
    )
    .bind(tenant_id) // <-- 【修改】绑定“钥匙”中的ID
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(ranks) => ranks,
        Err(e) => {
            tracing::error!("Failed to fetch honor ranks: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(ranks))
}

// (POST /api/v1/honor-ranks)
// (★ V3 - 角色安全加固 ★)
pub async fn create_honor_rank(
    State(state): State<AppState>,
    claims: Claims, // <-- 【修改】必须出示“钥匙”
    Json(payload): Json<CreateHonorRankPayload>,
) -> Result<Json<HonorRank>, StatusCode> {
    
    // --- (★ 新增：角色安全守卫 ★) ---
    let is_authorized = claims.roles.iter().any(|role| 
        role == "role.tenant.admin"
    );

    if !is_authorized {
        tracing::warn!(
            "Unauthorized attempt to create honor rank by user {} (roles: {:?})",
            claims.sub,
            claims.roles
        );
        return Err(StatusCode::FORBIDDEN); // 403 Forbidden
    }
    // --- (守卫结束) ---
    
    // (HACK 已移除!)
    let tenant_id = claims.tenant_id; // <-- 【修改】使用“钥匙”中的租户ID

    let new_rank = match sqlx::query_as::<_, HonorRank>(
        r#"
        INSERT INTO honor_ranks (tenant_id, name_key, rank_level, points_required, badge_icon_url)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        "#,
    )
    .bind(tenant_id) // <-- 【修改】绑定“钥匙”中的ID
    .bind(&payload.name_key)
    .bind(payload.rank_level)
    .bind(payload.points_required)
    .bind(payload.badge_icon_url)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(rank) => rank,
        Err(e) => {
            tracing::error!("Failed to create honor rank: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(new_rank))
}