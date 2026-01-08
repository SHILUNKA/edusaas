/*
 * src/handlers/staff.rs
 * 职责: 人效风控 - Staff/Personnel Risk Control & Rankings
 */
use axum::{extract::State, http::StatusCode, Json};
use super::AppState;
use crate::models::Claims;

// ==========================================
// 1. Risk Control Dashboard
// ==========================================

#[derive(serde::Serialize)]
pub struct StaffRiskStats {
    pub health_score: f64,
    pub alerts: Vec<RiskAlert>,
}

#[derive(serde::Serialize)]
pub struct RiskAlert {
    pub id: i32,
    pub message: String,
}

// GET /api/v1/hq/staff/risk-stats
pub async fn get_staff_risk_stats_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<StaffRiskStats>, StatusCode> {
    // Check HQ admin permission
    if !claims.roles.iter().any(|r| r == "role.hq.admin") {
        return Err(StatusCode::FORBIDDEN);
    }

    let hq_id = claims.hq_id;

    // Calculate health score based on active users
    let total_users = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM users WHERE hq_id = $1"
    )
    .bind(hq_id)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(1);

    let active_users = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM users WHERE hq_id = $1 AND is_active = true"
    )
    .bind(hq_id)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(0);

    let health_score = if total_users > 0 {
        (active_users as f64 / total_users as f64) * 100.0
    } else {
        100.0
    };

    // Get inactive accounts (not logged in for 30+ days)
    let inactive_count = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*) 
        FROM users 
        WHERE hq_id = $1 
        AND is_active = true
        AND (last_login_at IS NULL OR last_login_at < NOW() - INTERVAL '30 days')
        "#
    )
    .bind(hq_id)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(0);

    let mut alerts = Vec::new();
    if inactive_count > 0 {
        alerts.push(RiskAlert {
            id: 1,
            message: format!("发现 {} 个账号超过 30 天未登录", inactive_count),
        });
    }

    // Check for inactive staff that should be frozen
    let unfrozen_inactive = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*) 
        FROM users 
        WHERE hq_id = $1 
        AND staff_status = 'resigned' 
        AND is_active = true
        "#
    )
    .bind(hq_id)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(0);

    if unfrozen_inactive > 0 {
        alerts.push(RiskAlert {
            id: 2,
            message: format!("发现 {} 个离职员工账号尚未冻结", unfrozen_inactive),
        });
    }

    Ok(Json(StaffRiskStats {
        health_score,
        alerts,
    }))
}

// ==========================================
// 2. Key Personnel
// ==========================================

#[derive(serde::Serialize)]
pub struct KeyPersonnelItem {
    pub id: uuid::Uuid,
    pub name: String,
    pub role_type: String,
    pub role_name: String,
    pub base_name: String,
    pub avatar: String,
}

// GET /api/v1/hq/staff/key-personnel
pub async fn get_key_personnel_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<KeyPersonnelItem>>, StatusCode> {
    if !claims.roles.iter().any(|r| r == "role.hq.admin") {
        return Err(StatusCode::FORBIDDEN);
    }

    let hq_id = claims.hq_id;

    // Get HQ admins and base principals
    // Note: Simplified query - just get active users with base info
    let personnel = sqlx::query_as::<_, (uuid::Uuid, String, Option<String>, Option<uuid::Uuid>)>(
        r#"
        SELECT 
            u.id,
            u.full_name,
            b.name as base_name,
            u.base_id
        FROM users u
        LEFT JOIN bases b ON u.base_id = b.id
        WHERE u.hq_id = $1 
        AND u.is_active = true
        ORDER BY u.created_at DESC
        LIMIT 10
        "#,
    )
    .bind(hq_id)
    .fetch_all(&state.db_pool)
    .await
    .unwrap_or(vec![]);

    let result = personnel.into_iter().map(|(id, name, base_name, base_id)| {
        let (role_type, role_name, display_base_name) = if base_id.is_none() {
            ("admin".to_string(), "总部管理员".to_string(), "HQ".to_string())
        } else {
            ("principal".to_string(), "基地负责人".to_string(), base_name.unwrap_or("未知基地".to_string()))
        };
        
        KeyPersonnelItem {
            id,
            name,
            role_type,
            role_name,
            base_name: display_base_name,
            avatar: "".to_string(),
        }
    }).collect();


    Ok(Json(result))
}

// ==========================================
// 3. Base Rankings
// ==========================================

#[derive(serde::Serialize)]
pub struct BaseRankingData {
    pub id: uuid::Uuid,
    pub name: String,
    pub region: String,
    pub score: String,
}

// GET /api/v1/hq/staff/rankings/purchase
pub async fn get_purchase_rankings_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<BaseRankingData>>, StatusCode> {
    if !claims.roles.iter().any(|r| r == "role.hq.admin") {
        return Err(StatusCode::FORBIDDEN);
    }

    let hq_id = claims.hq_id;

    // Get bases ranked by total purchase amount (from supply orders)
    let rankings = sqlx::query_as::<_, (uuid::Uuid, String, String, Option<i64>)>(
        r#"
        SELECT 
            b.id,
            b.name,
            COALESCE(b.address, '未分配区域') as region,
            COALESCE(SUM(so.total_amount_cents), 0) as total_purchase
        FROM bases b
        LEFT JOIN supply_orders so ON b.id = so.base_id 
            AND so.status IN ('paid', 'shipped', 'completed')
        WHERE b.hq_id = $1
        GROUP BY b.id, b.name, b.address
        ORDER BY total_purchase DESC
        LIMIT 5
        "#,
    )
    .bind(hq_id)
    .fetch_all(&state.db_pool)
    .await
    .unwrap_or(vec![]);

    let result = rankings.into_iter().map(|(id, name, region, total_purchase)| {
        let amount = (total_purchase.unwrap_or(0) as f64) / 100.0;
        BaseRankingData {
            id,
            name,
            region,
            score: format!("{:.0}", amount),
        }
    }).collect();



    Ok(Json(result))
}

// GET /api/v1/hq/staff/rankings/activity
pub async fn get_activity_rankings_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<BaseRankingData>>, StatusCode> {
    if !claims.roles.iter().any(|r| r == "role.hq.admin") {
        return Err(StatusCode::FORBIDDEN);
    }

    let hq_id = claims.hq_id;

    // Activity score based on: class completion rate + student enrollment
    let rankings = sqlx::query_as::<_, (uuid::Uuid, String, String, Option<i64>)>(
        r#"
        SELECT 
            b.id,
            b.name,
            COALESCE(b.address, '未分配区域') as region,
            COALESCE(COUNT(DISTINCT CASE WHEN cl.status = 'completed' THEN cl.id END), 0) as activity_score
        FROM bases b
        LEFT JOIN classes cl ON b.id = cl.base_id 
            AND cl.start_time >= NOW() - INTERVAL '30 days'
        WHERE b.hq_id = $1
        GROUP BY b.id, b.name, b.address
        ORDER BY activity_score DESC
        LIMIT 5
        "#,
    )
    .bind(hq_id)
    .fetch_all(&state.db_pool)
    .await
    .unwrap_or(vec![]);

    let result = rankings.into_iter().map(|(id, name, region, activity_score)| {
        BaseRankingData {
            id,
            name,
            region, // region is already String from COALESCE
            score: format!("{:.1}", (activity_score.unwrap_or(0) as f64)),
        }
    }).collect();

    Ok(Json(result))
}
