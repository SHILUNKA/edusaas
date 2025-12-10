/*
 * src/handlers/honor.rs
 * 职责: 荣誉/等级 (HonorRank) 管理 (V4.1 - 修复版)
 */

use axum::{
    extract::{State, Path}, 
    http::StatusCode, 
    Json
};
use uuid::Uuid; 

use super::AppState;
use crate::models::{Claims, HonorRank, CreateHonorRankPayload, UpdateHonorRankPayload};

// (GET /api/v1/honor-ranks)
pub async fn get_honor_ranks(
    State(state): State<AppState>,
    claims: Claims, 
) -> Result<Json<Vec<HonorRank>>, StatusCode> {
    
    let tenant_id = claims.tenant_id; 

    let ranks = match sqlx::query_as::<_, HonorRank>(
        r#"
        SELECT * FROM honor_ranks
        WHERE tenant_id = $1
        ORDER BY rank_level ASC
        "#,
    )
    .bind(tenant_id) 
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

// (POST /api/v1/honor-ranks - 核心修复：恢复完整逻辑)
pub async fn create_honor_rank(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateHonorRankPayload>,
) -> Result<Json<HonorRank>, StatusCode> {
    
    // 1. 权限检查
    let is_authorized = claims.roles.iter().any(|role| 
        role == "role.tenant.admin"
    );

    if !is_authorized {
        tracing::warn!(
            "Unauthorized attempt to create honor rank by user {} (roles: {:?})",
            claims.sub,
            claims.roles
        );
        return Err(StatusCode::FORBIDDEN); 
    }
    
    let tenant_id = claims.tenant_id; 

    // 2. 插入数据
    let new_rank = match sqlx::query_as::<_, HonorRank>(
        r#"
        INSERT INTO honor_ranks (tenant_id, name_key, rank_level, points_required, badge_icon_url)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(&payload.name_key)
    .bind(payload.rank_level)
    .bind(payload.points_required)
    .bind(payload.badge_icon_url)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(rank) => rank,
        Err(e) => {
            // 捕获重复错误
            if let Some(db_err) = e.as_database_error() {
                if db_err.is_unique_violation() {
                    tracing::warn!("Failed to create honor rank: duplicate level {} or name {}", payload.rank_level, payload.name_key);
                    return Err(StatusCode::CONFLICT); // 409
                }
            }
            tracing::error!("Failed to create honor rank: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(new_rank))
}

// (PUT /api/v1/honor-ranks/:id - 更新积分)
pub async fn update_honor_rank(
    State(state): State<AppState>,
    claims: Claims,
    Path(rank_id): Path<Uuid>, 
    Json(payload): Json<UpdateHonorRankPayload>,
) -> Result<Json<HonorRank>, StatusCode> {
    
    // 1. 权限检查
    let is_authorized = claims.roles.iter().any(|role| role == "role.tenant.admin");
    if !is_authorized { return Err(StatusCode::FORBIDDEN); }

    // 2. 执行更新
    let updated_rank = match sqlx::query_as::<_, HonorRank>(
        r#"
        UPDATE honor_ranks 
        SET points_required = $1
        WHERE id = $2 AND tenant_id = $3
        RETURNING *
        "#,
    )
    .bind(payload.points_required)
    .bind(rank_id)
    .bind(claims.tenant_id)
    .fetch_optional(&state.db_pool) 
    .await
    {
        Ok(Some(rank)) => rank,
        Ok(None) => return Err(StatusCode::NOT_FOUND), // 找不到记录
        Err(e) => {
            tracing::error!("Failed to update honor rank: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(updated_rank))
}