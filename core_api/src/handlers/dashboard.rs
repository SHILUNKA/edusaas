/*
 * src/handlers/dashboard.rs
 * 职责: 看板统计
 * (★ V4 - 已添加“分店看板”API ★)
 */

use axum::{extract::State, http::StatusCode, Json};


// 【修改】导入 AppState 和 Claims
use super::AppState;
use super::auth::Claims; // <-- 我们需要“钥匙”
// 【修改】导入两个 Stats models
use crate::models::{DashboardStats, BaseDashboardStats};


// (GET /api/v1/dashboard/stats - 获取 *总部* 统计数据)
// (★ V3 - 角色安全加固 ★)
pub async fn get_dashboard_stats(
    State(state): State<AppState>,
    claims: Claims, // <-- 必须出示“钥匙”
) -> Result<Json<DashboardStats>, StatusCode> {
    
    // --- (★ 角色安全守卫 ★) ---
    let is_authorized = claims.roles.iter().any(|role| 
        role == "role.tenant.admin"
    );
    if !is_authorized {
        tracing::warn!(
            "Unauthorized attempt to access dashboard stats by user {} (roles: {:?})",
            claims.sub,
            claims.roles
        );
        return Err(StatusCode::FORBIDDEN); // 403 Forbidden
    }
    // --- (守卫结束) ---

    let tenant_id = claims.tenant_id;

    let stats = match sqlx::query_as::<_, DashboardStats>(
        r#"
        SELECT 
            (SELECT COUNT(*) FROM bases WHERE tenant_id = $1) AS total_bases
        "#,
    )
    .bind(tenant_id)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(stats) => stats,
        Err(e) => {
            tracing::error!("Failed to fetch dashboard stats: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(stats))
}


// --- 【新增 API】 ---

// (GET /api/v1/base/dashboard/stats - 获取 *分店* 统计数据)
// (★ V2 - 基地安全加固 ★)
pub async fn get_base_dashboard_stats(
    State(state): State<AppState>,
    claims: Claims, // <-- 必须出示“钥匙”
) -> Result<Json<BaseDashboardStats>, StatusCode> {

    let tenant_id = claims.tenant_id;

    // --- (★ 安全校验 1: 必须是基地员工) ---
    // 只有基地员工才能访问“分店”看板
    let base_id = match claims.base_id {
        Some(id) => id,
        None => {
            tracing::warn!(
                "Tenant admin (user {}) without base_id tried to access base dashboard",
                claims.sub
            );
            // 403 Forbidden: 总部管理员不允许此操作
            return Err(StatusCode::FORBIDDEN); 
        }
    };

    // --- (★ 核心逻辑: 并发查询三个指标) ---
    // (我们使用 'CURRENT_DATE' 来获取今天的日期, 它会使用数据库服务器的时区)
    let stats = match sqlx::query_as::<_, BaseDashboardStats>(
        r#"
        SELECT
            (
                SELECT COUNT(DISTINCT p.id) 
                FROM participants p 
                JOIN customers c ON p.customer_id = c.id 
                WHERE c.base_id = $1 AND p.tenant_id = $2
            ) AS participant_count,
            (
                SELECT COUNT(cm.id) 
                FROM customer_memberships cm 
                JOIN customers c ON cm.customer_id = c.id 
                WHERE c.base_id = $1 AND cm.tenant_id = $2 AND cm.is_active = true
            ) AS member_count,
            (
                SELECT COUNT(id) 
                FROM classes 
                WHERE base_id = $1 AND tenant_id = $2 AND start_time::date = CURRENT_DATE
            ) AS today_class_count
        "#,
    )
    .bind(base_id)   // $1
    .bind(tenant_id) // $2
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(stats) => stats,
        Err(e) => {
            tracing::error!("Failed to fetch base dashboard stats: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(stats))
}