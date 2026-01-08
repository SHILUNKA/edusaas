/*
 * src/handlers/customer_schedule.rs
 * 职责: C端课表与教务相关API
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
pub struct ScheduleQuery {
    pub participant_id: Uuid,
    pub start_date: Option<String>, // YYYY-MM-DD
    pub end_date: Option<String>,
    pub status: Option<String>, // upcoming|completed
}

#[derive(Debug, Serialize)]
pub struct ClassScheduleItem {
    pub id: Uuid,
    pub course_name: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub room_name: String,
    pub teacher_name: Option<String>,
    pub enrollment: EnrollmentInfo,
}

#[derive(Debug, Serialize)]
pub struct EnrollmentInfo {
    pub status: String, // signed_in|absent|leave
    pub signed_in_at: Option<DateTime<Utc>>,
    pub teacher_feedback: Option<String>,
    pub rating: Option<i32>,
    pub photos: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct ScheduleResponse {
    pub classes: Vec<ClassScheduleItem>,
}

#[derive(Debug, Deserialize)]
pub struct CourseBalanceQuery {
    pub participant_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct MembershipBalance {
    pub id: Uuid,
    pub tier_name: String,
    pub tier_type: String,
    pub remaining_uses: Option<i32>,
    pub total_uses: Option<i32>,
    pub expiry_date: Option<DateTime<Utc>>,
    pub status: String, // active|expired|exhausted
}

#[derive(Debug, Serialize)]
pub struct CourseBalanceResponse {
    pub memberships: Vec<MembershipBalance>,
}

// ==========================================
// API Handlers
// ==========================================

// GET /api/v1/customer/schedule - 获取学员课表
pub async fn get_customer_schedule_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(params): Query<ScheduleQuery>,
) -> Result<Json<ScheduleResponse>, StatusCode> {
    
    // 查询学员的课程安排
    let classes = sqlx::query_as::<_, ClassScheduleRaw>(
        r#"
        SELECT 
            c.id,
            co.name_key as course_name,
            c.start_time,
            c.end_time,
            r.name as room_name,
            u.full_name as teacher_name,
            ce.status as enrollment_status,
            ce.teacher_feedback,
            ce.created_at as signed_in_at
        FROM class_enrollments ce
        INNER JOIN classes c ON ce.class_id = c.id
        INNER JOIN courses co ON c.course_id = co.id
        INNER JOIN rooms r ON c.room_id = r.id
        LEFT JOIN class_teachers ct ON c.id = ct.class_id
        LEFT JOIN teachers t ON ct.teacher_id = t.user_id
        LEFT JOIN users u ON t.user_id = u.id
        WHERE ce.participant_id = $1 
            AND ce.hq_id = $2
        ORDER BY c.start_time DESC
        LIMIT 50
        "#,
    )
    .bind(params.participant_id)
    .bind(claims.hq_id)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch customer schedule: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let schedule_items: Vec<ClassScheduleItem> = classes
        .into_iter()
        .map(|c| ClassScheduleItem {
            id: c.id,
            course_name: c.course_name,
            start_time: c.start_time,
            end_time: c.end_time,
            room_name: c.room_name,
            teacher_name: c.teacher_name,
            enrollment: EnrollmentInfo {
                status: c.enrollment_status.unwrap_or_else(|| "enrolled".to_string()),
                signed_in_at: c.signed_in_at,
                teacher_feedback: c.teacher_feedback,
                rating: None, // TODO: 添加评分字段
                photos: vec![], // TODO: 添加课堂照片
            },
        })
        .collect();

    Ok(Json(ScheduleResponse {
        classes: schedule_items,
    }))
}

#[derive(Debug, sqlx::FromRow)]
struct ClassScheduleRaw {
    id: Uuid,
    course_name: String,
    start_time: DateTime<Utc>,
    end_time: DateTime<Utc>,
    room_name: String,
    teacher_name: Option<String>,
    enrollment_status: Option<String>,
    teacher_feedback: Option<String>,
    signed_in_at: Option<DateTime<Utc>>,
}

// GET /api/v1/customer/course-balance - 查看课时余额
pub async fn get_course_balance_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(params): Query<CourseBalanceQuery>,
) -> Result<Json<CourseBalanceResponse>, StatusCode> {
    
    let memberships = sqlx::query_as::<_, MembershipBalanceRaw>(
        r#"
        SELECT 
            cm.id,
            mt.name_key as tier_name,
            mt.tier_type::text as tier_type,
            cm.remaining_uses,
            mt.usage_count as total_uses,
            cm.expiry_date,
            cm.is_active
        FROM customer_memberships cm
        INNER JOIN membership_tiers mt ON cm.tier_id = mt.id
        WHERE cm.participant_id = $1 
            AND cm.hq_id = $2
        ORDER BY cm.created_at DESC
        "#,
    )
    .bind(params.participant_id)
    .bind(claims.hq_id)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch course balance: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let balances: Vec<MembershipBalance> = memberships
        .into_iter()
        .map(|m| {
            let status = if !m.is_active {
                "inactive".to_string()
            } else if let Some(expiry) = m.expiry_date {
                if expiry < Utc::now() {
                    "expired".to_string()
                } else if m.remaining_uses.map(|r| r <= 0).unwrap_or(false) {
                    "exhausted".to_string()
                } else {
                    "active".to_string()
                }
            } else {
                "active".to_string()
            };

            MembershipBalance {
                id: m.id,
                tier_name: m.tier_name,
                tier_type: m.tier_type,
                remaining_uses: m.remaining_uses,
                total_uses: m.total_uses,
                expiry_date: m.expiry_date,
                status,
            }
        })
        .collect();

    Ok(Json(CourseBalanceResponse {
        memberships: balances,
    }))
}

#[derive(Debug, sqlx::FromRow)]
struct MembershipBalanceRaw {
    id: Uuid,
    tier_name: String,
    tier_type: String,
    remaining_uses: Option<i32>,
    total_uses: Option<i32>,
    expiry_date: Option<DateTime<Utc>>,
    is_active: bool,
}
