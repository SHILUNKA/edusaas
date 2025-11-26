/*
 * src/handlers/tenant.rs
 * 职责: 租户级总览 (例如: 学员总览)
 * (★ V4.0 - 修复 base_name 缺失导致的 500 错误 ★)
 */

use axum::{extract::State, http::StatusCode, Json};

// 导入 AppState 和 Claims
use super::AppState;
use super::auth::Claims; 
// 导入 models
use crate::models::ParticipantDetail;

// (GET /api/v1/tenant/participants - 获取本租户 "所有" 学员的详细列表)
pub async fn get_all_tenant_participants(
    State(state): State<AppState>,
    claims: Claims, 
) -> Result<Json<Vec<ParticipantDetail>>, StatusCode> {
    
    // 1. 权限检查
    let is_authorized = claims.roles.iter().any(|role| 
        role == "role.tenant.admin"
    );

    if !is_authorized {
        tracing::warn!(
            "Unauthorized attempt to access all tenant participants by user {} (roles: {:?})",
            claims.sub,
            claims.roles
        );
        return Err(StatusCode::FORBIDDEN); 
    }

    let tenant_id = claims.tenant_id; 

    // 2. 执行查询 (★ 关键修复: 添加 base_name 字段和 JOIN bases 表)
    let participants = match sqlx::query_as::<_, ParticipantDetail>(
        r#"
        SELECT 
            p.id, p.name, p.date_of_birth, p.gender,
            c.name AS customer_name,
            c.phone_number AS customer_phone,
            pp.current_total_points,
            hr.name_key AS rank_name_key,
            b.name AS base_name  -- <--- (★ 补回这个字段)
        FROM 
            participants p
        JOIN 
            customers c ON p.customer_id = c.id
        LEFT JOIN 
            bases b ON c.base_id = b.id -- <--- (★ 补回这个 JOIN)
        LEFT JOIN 
            participant_profiles pp ON p.id = pp.participant_id
        LEFT JOIN 
            honor_ranks hr ON pp.current_honor_rank_id = hr.id
        WHERE 
            p.tenant_id = $1
        ORDER BY 
            b.name ASC, p.created_at DESC
        "#,
    )
    .bind(tenant_id) 
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(participants) => participants,
        Err(e) => {
            tracing::error!("Failed to fetch all participants: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(participants))
}