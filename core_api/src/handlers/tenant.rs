/*
 * src/handlers/tenant.rs
 * 职责: 租户级总览 (例如: 学员总览)
 * (★ V3 - 角色安全加固版 ★)
 */

use axum::{extract::State, http::StatusCode, Json};


// 【修改】导入 AppState 和 Claims
use super::AppState;
use super::auth::Claims; // <-- 我们需要“钥匙”
// 导入 models
use crate::models::ParticipantDetail;

// (GET /api/v1/tenant/participants - 获取本租户 "所有" 学员的详细列表)
// (★ V3 - 角色安全加固 ★)
pub async fn get_all_tenant_participants(
    State(state): State<AppState>,
    claims: Claims, // <-- 【修改】必须出示“钥匙”
) -> Result<Json<Vec<ParticipantDetail>>, StatusCode> {
    
    // --- (★ 新增：角色安全守卫 ★) ---
    // (总花名册是总部权限)
    let is_authorized = claims.roles.iter().any(|role| 
        role == "role.tenant.admin"
    );

    if !is_authorized {
        tracing::warn!(
            "Unauthorized attempt to access all tenant participants by user {} (roles: {:?})",
            claims.sub,
            claims.roles
        );
        return Err(StatusCode::FORBIDDEN); // 403 Forbidden
    }
    // --- (守卫结束) ---

    // (HACK 已移除!)
    let tenant_id = claims.tenant_id; // <-- 【修改】使用“钥匙”中的租户ID

    let participants = match sqlx::query_as::<_, ParticipantDetail>(
        r#"
        SELECT 
            p.id, p.name, p.date_of_birth, p.gender,
            c.name AS customer_name,
            c.phone_number AS customer_phone,
            pp.current_total_points,
            hr.name_key AS rank_name_key
        FROM 
            participants p
        JOIN 
            customers c ON p.customer_id = c.id
        LEFT JOIN 
            participant_profiles pp ON p.id = pp.participant_id
        LEFT JOIN 
            honor_ranks hr ON pp.current_honor_rank_id = hr.id
        WHERE 
            p.tenant_id = $1
        ORDER BY 
            p.created_at DESC
        "#,
    )
    .bind(tenant_id) // <-- 【修改】绑定“钥匙”中的ID
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