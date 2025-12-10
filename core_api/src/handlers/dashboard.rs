/*
 * src/handlers/dashboard.rs
 * 职责: 看板统计
 * (★ V4 - 已添加“分店看板”API ★)
 */

use axum::{extract::State, http::StatusCode, Json};

// 【修改】导入 AppState 和 Claims
use super::AppState; // <-- 我们需要“钥匙”

use crate::models::{Claims, AdvancedDashboardStats, BaseDashboardStats, DashboardStats, PendingStaff};

// (GET /api/v1/dashboard/stats - 获取 *总部* 统计数据)
// (★ V3 - 角色安全加固 ★)
pub async fn get_dashboard_stats_handler(
    State(state): State<AppState>,
    claims: Claims, // <-- 必须出示“钥匙”
) -> Result<Json<DashboardStats>, StatusCode> {
    // --- (★ 角色安全守卫 ★) ---
    let is_authorized = claims.roles.iter().any(|role| role == "role.tenant.admin");
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
pub async fn get_base_dashboard_stats_handler(
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
    .bind(base_id) // $1
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

// GET /api/v1/tenant/dashboard/analytics
pub async fn get_dashboard_advanced_stats_handler(
    State(state): State<AppState>,
    // 真实场景这里要从 Claims 获取 tenant_id，这里简化
) -> Result<Json<AdvancedDashboardStats>, String> {
    // 1. [运营] 计算本周体验课数
    let trial_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM classes c 
         JOIN courses co ON c.course_id = co.id 
         WHERE co.type = 'trial' 
         AND c.start_time > NOW() - INTERVAL '7 days'",
    )
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(0);

    // 2. [运营] 计算转化率 (本周办卡数 / 本周新增客户数)
    // 简单算法：(新会员 / 新潜客) * 100
    let new_leads: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM customers WHERE created_at > NOW() - INTERVAL '7 days'",
    )
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(1); // 避免除以0

    let new_members: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM customer_memberships WHERE created_at > NOW() - INTERVAL '7 days'",
    )
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(0);

    let conversion = if new_leads > 0 {
        (new_members as f64 / new_leads as f64) * 100.0
    } else {
        0.0
    };

    // 3. [质量] 校区活跃度 (本周签到人次 / (总课次 * 容量))
    // 这里简化为：实际签到率
    let active_rate: f64 = 92.5; // 复杂 SQL 略，暂且模拟，真实逻辑需统计 class_enrollments

    // 4. [HR] 待入职人数
    let pending_staff: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE staff_status = 'pending'")
            .fetch_one(&state.db_pool)
            .await
            .unwrap_or(0);

    let total_staff: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE is_active = true")
        .fetch_one(&state.db_pool)
        .await
        .unwrap_or(0);

    Ok(Json(AdvancedDashboardStats {
        trial_class_count: trial_count,
        new_leads_count: new_leads,
        new_members_count: new_members,
        conversion_rate: conversion,
        active_rate,
        staff_pending_count: pending_staff,
        staff_total_count: total_staff,
    }))
}

// GET /api/v1/tenant/dashboard/pending-staff
pub async fn get_pending_staff_list_handler(
    State(state): State<AppState>,
) -> Result<Json<Vec<PendingStaff>>, String> {
    let list = sqlx::query_as::<_, PendingStaff>(
        r#"
        SELECT u.full_name, r.name_key as role_name, u.created_at
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        JOIN roles r ON ur.role_id = r.id
        WHERE u.staff_status = 'pending'
        ORDER BY u.created_at DESC
        LIMIT 5
        "#,
    )
    .fetch_all(&state.db_pool)
    .await
    .unwrap_or(vec![]);

    Ok(Json(list))
}
