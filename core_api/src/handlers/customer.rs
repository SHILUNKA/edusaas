/*
 * src/handlers/customer.rs
 * 职责: 客户/家长 (Customer) 管理 (SaaS 强化 + C端API)
 */

use axum::{
    extract::{State, Query},
    http::StatusCode,
    Json,
};
use serde::Serialize;
use uuid::Uuid;
use chrono::NaiveDate;

// 导入在 mod.rs 中定义的 AppState
use super::AppState;
// 导入 models
use crate::models::{Claims, Customer, CreateCustomerPayload};

// ==========================================
// C端API响应模型
// ==========================================

#[derive(Debug, Serialize)]
pub struct ParticipantWithHonor {
    pub id: Uuid,
    pub name: String,
    pub date_of_birth: Option<NaiveDate>,
    pub gender: Option<String>,
    pub avatar_url: Option<String>,
    pub school_name: Option<String>,
    pub current_honor_rank: Option<HonorRankInfo>,
}

#[derive(Debug, Serialize)]
pub struct HonorRankInfo {
    pub rank_name: String,
    pub rank_level: i32,
    pub badge_icon_url: Option<String>,
    pub total_points: i32,
    pub next_rank_points: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct CustomerProfileResponse {
    pub customer: CustomerInfo,
}

#[derive(Debug, Serialize)]
pub struct CustomerInfo {
    pub id: Uuid,
    pub name: Option<String>,
    pub phone_number: String,
    pub avatar_url: Option<String>,
    pub participants: Vec<ParticipantWithHonor>,
}

#[derive(Debug, Serialize)]
pub struct CustomerReportResponse {
    pub participant_name: String,
    pub total_classes: i64,
    pub attended_classes: i64,
    pub attendance_rate: f64,
    pub total_points: i32,
    pub rank_name: Option<String>,
    pub latest_feedback: Option<String>,
    pub points_trend: Vec<PointTrendItem>,
}

#[derive(Debug, Serialize)]
pub struct PointTrendItem {
    pub date: String,
    pub points: i32,
}

// ==========================================
// C端API Handlers
// ==========================================

// GET /api/v1/customer/profile - 获取C端用户档案(包含所有学员及荣誉信息)
pub async fn get_customer_profile_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<CustomerProfileResponse>, StatusCode> {
    // 从claims.sub中获取customer_id
    let customer_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::BAD_REQUEST)?;

    // 首先找到customer
    let customer = sqlx::query_as::<_, Customer>(
        r#"
        SELECT * FROM customers
        WHERE id = $1
        "#,
    )
    .bind(customer_id)
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch customer: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    // 获取该customer下的所有participants及其荣誉信息
    let participants = sqlx::query_as::<_, ParticipantWithHonorRaw>(
        r#"
        SELECT 
            p.id,
            p.name,
            p.date_of_birth,
            p.gender,
            p.avatar_url,
            p.school_name,
            pp.current_total_points,
            hr.name_key as rank_name_key,
            hr.rank_level,
            hr.badge_icon_url,
            hr.points_required as current_rank_points,
            next_hr.points_required as next_rank_points
        FROM participants p
        LEFT JOIN participant_profiles pp ON p.id = pp.participant_id
        LEFT JOIN honor_ranks hr ON pp.current_honor_rank_id = hr.id
        LEFT JOIN honor_ranks next_hr ON next_hr.rank_level = hr.rank_level + 1 
            AND next_hr.hq_id = hr.hq_id
        WHERE p.customer_id = $1 AND p.hq_id = $2
        ORDER BY p.name
        "#,
    )
    .bind(customer.id)
    .bind(claims.hq_id)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch participants with honor: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let participants_with_honor: Vec<ParticipantWithHonor> = participants
        .into_iter()
        .map(|p| ParticipantWithHonor {
            id: p.id,
            name: p.name,
            date_of_birth: p.date_of_birth,
            gender: p.gender,
            avatar_url: p.avatar_url,
            school_name: p.school_name,
            current_honor_rank: p.rank_name_key.map(|rank_name| HonorRankInfo {
                rank_name,
                rank_level: p.rank_level.unwrap_or(0),
                badge_icon_url: p.badge_icon_url,
                total_points: p.current_total_points.unwrap_or(0),
                next_rank_points: p.next_rank_points,
            }),
        })
        .collect();

    Ok(Json(CustomerProfileResponse {
        customer: CustomerInfo {
            id: customer.id,
            name: customer.name,
            phone_number: customer.phone_number,
            avatar_url: customer.avatar_url,
            participants: participants_with_honor,
        },
    }))
}

// 辅助结构用于查询
#[derive(Debug, sqlx::FromRow)]
struct ParticipantWithHonorRaw {
    id: Uuid,
    name: String,
    date_of_birth: Option<NaiveDate>,
    gender: Option<String>,
    avatar_url: Option<String>,
    school_name: Option<String>,
    current_total_points: Option<i32>,
    rank_name_key: Option<String>,
    rank_level: Option<i32>,
    badge_icon_url: Option<String>,
    current_rank_points: Option<i32>,
    next_rank_points: Option<i32>,
}

// (POST /api/v1/customers - B端创建家长)
pub async fn create_customer_handler(
    State(state): State<AppState>,
    claims: Claims, // <-- 自动验证 Token, 获取 Claims
    Json(payload): Json<CreateCustomerPayload>,
) -> Result<Json<Customer>, StatusCode> {
    
    let hq_id = claims.hq_id;

    let base_id = match claims.base_id {
        Some(id) => id,
        None => {
            tracing::warn!("User {} without base_id tried to create customer", claims.sub);
            return Err(StatusCode::FORBIDDEN); // 403 Forbidden
        }
    };

    let new_customer = match sqlx::query_as::<_, Customer>(
        r#"
        INSERT INTO customers (hq_id, base_id, name, phone_number)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(hq_id)
    .bind(base_id)
    .bind(payload.name)
    .bind(&payload.phone_number)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(customer) => customer,
        Err(e) => {
            if let Some(db_err) = e.as_database_error() {
                if db_err.is_unique_violation() {
                    tracing::warn!("Failed to create customer, phone number already exists: {}", payload.phone_number);
                    return Err(StatusCode::CONFLICT); // 409 Conflict
                }
            }
            tracing::error!("Failed to create customer: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(new_customer))
}

// (GET /api/v1/customers - 获取客户列表)
pub async fn get_customers_handler(
    State(state): State<AppState>,
    claims: Claims, // <-- 自动验证 Token, 获取 Claims
) -> Result<Json<Vec<Customer>>, StatusCode> {
    
    let customers: Vec<Customer>;

    if let Some(base_id) = claims.base_id {
        // --- 场景 A: 基地员工 ---
        tracing::debug!("Fetching customers for base_id: {}", base_id);
        customers = sqlx::query_as::<_, Customer>(
            r#"
            SELECT * FROM customers
            WHERE hq_id = $1 AND base_id = $2
            ORDER BY created_at DESC
            "#,
        )
        .bind(claims.hq_id)
        .bind(base_id)
        .fetch_all(&state.db_pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch base customers: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
        
    } else {
        // --- 场景 B: 租户管理员 (无 base_id) ---
        tracing::debug!("Fetching all customers for hq_id: {}", claims.hq_id);
        customers = sqlx::query_as::<_, Customer>(
            r#"
            SELECT * FROM customers
            WHERE hq_id = $1
            ORDER BY base_id, created_at DESC
            "#,
        )
        .bind(claims.hq_id)
        .fetch_all(&state.db_pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch all hq customers: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    }

    Ok(Json(customers))
}

// GET /api/v1/customer/orders - 获取C端用户订单
pub async fn get_customer_orders_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<crate::models::OrderDetail>>, StatusCode> {
    let customer_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::BAD_REQUEST)?;

    let orders = sqlx::query_as::<_, crate::models::OrderDetail>(
        r#"
        SELECT * FROM income_orders
        WHERE customer_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(customer_id)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch customer orders: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(orders))
}

// GET /api/v1/customer/membership-tiers - 获取C端可用会员/产品列表
pub async fn get_customer_membership_tiers_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<crate::models::MembershipTier>>, StatusCode> {
    // 默认返回当前总部下处于激活状态的会员等级
    let tiers = sqlx::query_as::<_, crate::models::MembershipTier>(
        r#"
        SELECT * FROM membership_tiers
        WHERE hq_id = $1 AND is_active = true
        ORDER BY price_in_cents ASC
        "#,
    )
    .bind(claims.hq_id)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch membership tiers: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(tiers))
}

// GET /api/v1/customer/notices - 获取C端用户所属基地的通知公告
pub async fn get_customer_notices_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    // 获取该客户所属的基地ID (从claims.base_id 获取，如果后端在登录时没塞，则需要从数据库查)
    // 我们的 dev_token_ 已经塞了 base_id
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;

    let notices = sqlx::query!(
        r#"
        SELECT id, title, content, priority, created_at
        FROM notices
        WHERE base_id = $1
        ORDER BY created_at DESC
        "#,
        base_id
    )
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch customer notices: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let result = notices.into_iter().map(|n| {
        serde_json::json!({
            "id": n.id,
            "title": n.title,
            "content": n.content,
            "priority": n.priority,
            "created_at": n.created_at
        })
    }).collect();

    Ok(Json(result))
}

// GET /api/v1/customer/report - 获取学员成长报告
pub async fn get_customer_participant_report_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<CustomerReportResponse>, StatusCode> {
    let participant_id_str = params.get("participant_id").ok_or(StatusCode::BAD_REQUEST)?;
    let participant_id = Uuid::parse_str(participant_id_str).map_err(|_| StatusCode::BAD_REQUEST)?;

    // 1. 获取学员基本信息与勋章级别
    let info = sqlx::query!(
        r#"
        SELECT p.name, pp.current_total_points, hr.name_key as "rank_name?"
        FROM participants p
        LEFT JOIN participant_profiles pp ON p.id = pp.participant_id
        LEFT JOIN honor_ranks hr ON pp.current_honor_rank_id = hr.id
        WHERE p.id = $1
        "#,
        participant_id
    )
    .fetch_one(&state.db_pool)
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;

    // 2. 出勤统计
    let stats = sqlx::query!(
        r#"
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'signed_in' THEN 1 ELSE 0 END) as attended
        FROM class_enrollments
        WHERE participant_id = $1
        "#,
        participant_id
    )
    .fetch_one(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let total = stats.total.unwrap_or(0);
    let attended = stats.attended.unwrap_or(0);
    let rate = if total > 0 { (attended as f64 / total as f64) * 100.0 } else { 0.0 };

    // 3. 最新评价
    let latest_feedback = sqlx::query_scalar!(
        "SELECT teacher_feedback as \"teacher_feedback!\" FROM class_enrollments WHERE participant_id = $1 AND teacher_feedback IS NOT NULL ORDER BY created_at DESC LIMIT 1",
        participant_id
    )
    .fetch_optional(&state.db_pool)
    .await
    .unwrap_or(None);

    // 4. 积分趋势 (最近7天)
    let trend = sqlx::query!(
        r#"
        SELECT date_trunc('day', created_at) as day, SUM(points_change) as pts
        FROM point_transactions
        WHERE participant_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY day ORDER BY day
        "#,
        participant_id
    )
    .fetch_all(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let points_trend = trend.into_iter().map(|t| PointTrendItem {
        date: t.day.unwrap_or_default().to_string(),
        points: t.pts.unwrap_or(0) as i32,
    }).collect();

    Ok(Json(CustomerReportResponse {
        participant_name: info.name,
        total_classes: total,
        attended_classes: attended,
        attendance_rate: rate,
        total_points: info.current_total_points,
        rank_name: info.rank_name,
        latest_feedback,
        points_trend,
    }))
}