/*
 * src/handlers/customer_honor.rs
 * 职责: C端荣誉与积分系统API
 */

use axum::{
    extract::{State, Query},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

use super::AppState;
use crate::models::Claims;

// ==========================================
// 请求/响应模型
// ==========================================

#[derive(Debug, Deserialize)]
pub struct HonorQuery {
    pub participant_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct HonorResponse {
    pub current_rank: RankInfo,
    pub next_rank: Option<RankInfo>,
    pub total_points: i32,
    pub points_to_next_rank: Option<i32>,
    pub progress_percentage: f32,
    pub monthly_points: i32,
    pub class_rank: Option<i32>,
    pub school_rank: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct RankInfo {
    pub id: Uuid,
    pub name_key: String,
    pub display_name: String,
    pub rank_level: i32,
    pub badge_icon_url: Option<String>,
    pub points_required: i32,
}

#[derive(Debug, Deserialize)]
pub struct PointsHistoryQuery {
    pub participant_id: Uuid,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub page: Option<i32>,
    pub limit: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct PointsHistoryResponse {
    pub records: Vec<PointRecord>,
    pub total: i32,
    pub page: i32,
    pub total_pages: i32,
}

#[derive(Debug, Serialize)]
pub struct PointRecord {
    pub id: Uuid,
    pub points: i32,
    pub reason: String,
    pub category: String,
    pub created_at: DateTime<Utc>,
    pub related_class_id: Option<Uuid>,
}

// ==========================================
// API Handlers
// ==========================================

// GET /api/v1/customer/honor - 获取荣誉信息
pub async fn get_customer_honor_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(params): Query<HonorQuery>,
) -> Result<Json<HonorResponse>, StatusCode> {
    
    // 获取学员的积分档案
    let profile = sqlx::query_as::<_, ParticipantProfile>(
        r#"
        SELECT 
            pp.participant_id,
            pp.current_total_points,
            pp.current_honor_rank_id,
            hr.name_key,
            hr.rank_level,
            hr.badge_icon_url,
            hr.points_required
        FROM participant_profiles pp
        LEFT JOIN honor_ranks hr ON pp.current_honor_rank_id = hr.id
        WHERE pp.participant_id = $1 AND pp.hq_id = $2
        "#,
    )
    .bind(params.participant_id)
    .bind(claims.hq_id)
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch honor profile: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 如果没有档案,返回默认数据
    let total_points = profile.as_ref().map(|p| p.current_total_points).unwrap_or(0);
    let current_rank_level = profile.as_ref().and_then(|p| p.rank_level).unwrap_or(1);

    // 获取当前等级信息
    let current_rank_info = if let Some(ref p) = profile {
        if let Some(rank_id) = p.current_honor_rank_id {
            sqlx::query_as::<_, HonorRankRow>(
                "SELECT id, name_key, rank_level, badge_icon_url, points_required FROM honor_ranks WHERE id = $1",
            )
            .bind(rank_id)
            .fetch_optional(&state.db_pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch current rank: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
        } else {
            None
        }
    } else {
        None
    };

    // 获取下一级等级信息
    let next_rank_info = sqlx::query_as::<_, HonorRankRow>(
        r#"
        SELECT id, name_key, rank_level, badge_icon_url, points_required 
        FROM honor_ranks 
        WHERE hq_id = $1 AND rank_level = $2
        ORDER BY rank_level
        LIMIT 1
        "#,
    )
    .bind(claims.hq_id)
    .bind(current_rank_level + 1)
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch next rank: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 计算进度
    let points_to_next = next_rank_info.as_ref().map(|nr| nr.points_required - total_points);
    let progress_percentage = if let Some(next_rank) = &next_rank_info {
        let current_points_req = current_rank_info.as_ref().map(|r| r.points_required).unwrap_or(0);
        let range = next_rank.points_required - current_points_req;
        if range > 0 {
            ((total_points - current_points_req) as f32 / range as f32 * 100.0).min(100.0)
        } else {
            100.0
        }
    } else {
        100.0 // 已达到最高等级
    };

    // 获取本月积分
    let monthly_points = sqlx::query_scalar::<_, i32>(
        r#"
        SELECT COALESCE(SUM(points_change), 0)
        FROM point_transactions
        WHERE participant_id = $1 
            AND hq_id = $2
            AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)
        "#,
    )
    .bind(params.participant_id)
    .bind(claims.hq_id)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(0);

    // 构造响应
    let default_rank = HonorRankRow {
        id: Uuid::nil(),
        name_key: "新手".to_string(),
        rank_level: 0,
        badge_icon_url: None,
        points_required: 0,
    };

    let current = current_rank_info.unwrap_or(default_rank);

    Ok(Json(HonorResponse {
        current_rank: RankInfo {
            id: current.id,
            name_key: current.name_key.clone(),
            display_name: current.name_key,
            rank_level: current.rank_level,
            badge_icon_url: current.badge_icon_url,
            points_required: current.points_required,
        },
        next_rank: next_rank_info.map(|nr| RankInfo {
            id: nr.id,
            name_key: nr.name_key.clone(),
            display_name: nr.name_key,
            rank_level: nr.rank_level,
            badge_icon_url: nr.badge_icon_url,
            points_required: nr.points_required,
        }),
        total_points,
        points_to_next_rank: points_to_next,
        progress_percentage,
        monthly_points,
        class_rank: None, // TODO: 实现班级排名
        school_rank: None, // TODO: 实现校区排名
    }))
}

#[derive(Debug, sqlx::FromRow)]
struct ParticipantProfile {
    participant_id: Uuid,
    current_total_points: i32,
    current_honor_rank_id: Option<Uuid>,
    name_key: Option<String>,
    rank_level: Option<i32>,
    badge_icon_url: Option<String>,
    points_required: Option<i32>,
}

#[derive(Debug, sqlx::FromRow)]
struct HonorRankRow {
    id: Uuid,
    name_key: String,
    rank_level: i32,
    badge_icon_url: Option<String>,
    points_required: i32,
}

// GET /api/v1/customer/points-history - 积分明细
pub async fn get_points_history_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(params): Query<PointsHistoryQuery>,
) -> Result<Json<PointsHistoryResponse>, StatusCode> {
    
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(20).min(100);
    let offset = (page - 1) * limit;

    // 查询积分记录
    let records = sqlx::query_as::<_, PointRecordRaw>(
        r#"
        SELECT 
            id,
            points_change,
            reason_key,
            created_at
        FROM point_transactions
        WHERE participant_id = $1 AND hq_id = $2
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(params.participant_id)
    .bind(claims.hq_id)
    .bind(limit as i64)
    .bind(offset as i64)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch points history: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 查询总积分
    let total_points = sqlx::query_scalar::<_, i32>(
        r#"
        SELECT current_total_points
        FROM participant_profiles
        WHERE participant_id = $1 AND hq_id = $2
        "#,
    )
    .bind(params.participant_id)
    .bind(claims.hq_id)
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch total points: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .unwrap_or(0);

    // 查询总记录数
    let total_count = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM point_transactions
        WHERE participant_id = $1 AND hq_id = $2
        "#,
    )
    .bind(params.participant_id)
    .bind(claims.hq_id)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(0);

    let total_pages = ((total_count as f32 / limit as f32).ceil() as i32).max(1);

    let point_records: Vec<PointRecord> = records
        .into_iter()
        .map(|r| PointRecord {
            id: r.id,
            points: r.points_change,
            reason: r.reason_key.clone(),
            category: categorize_reason(&r.reason_key),
            created_at: r.created_at,
            related_class_id: None, // TODO: 关联课程ID
        })
        .collect();

    Ok(Json(PointsHistoryResponse {
        records: point_records,
        total: total_points,
        page,
        total_pages,
    }))
}

#[derive(Debug, sqlx::FromRow)]
struct PointRecordRaw {
    id: Uuid,
    points_change: i32,
    reason_key: String,
    created_at: DateTime<Utc>,
}

// 辅助函数：根据reason_key推断category
fn categorize_reason(reason: &str) -> String {
    if reason.contains("attendance") || reason.contains("出勤") {
        "attendance".to_string()
    } else if reason.contains("homework") || reason.contains("作业") {
        "homework".to_string()
    } else if reason.contains("competition") || reason.contains("比赛") {
        "competition".to_string()
    } else if reason.contains("activity") || reason.contains("活动") {
        "activity".to_string()
    } else {
        "other".to_string()
    }
}
