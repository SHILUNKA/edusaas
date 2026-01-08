/*
 * src/handlers/lead.rs
 * 职责: 销售线索管理 - Lead Management for Base Principals
 */
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use super::AppState;
use crate::models::Claims;

// ==========================================
// 1. Data Models
// ==========================================

#[derive(Serialize)]
pub struct LeadItem {
    pub id: uuid::Uuid,
    pub contact_name: String,
    pub phone_number: String,
    pub child_name: Option<String>,
    pub child_age: Option<i32>,
    pub source: Option<String>,
    pub status: String,
    pub quality_score: Option<i32>,
    pub assigned_to_name: Option<String>,
    pub last_contact_at: Option<chrono::DateTime<chrono::Utc>>,
    pub next_follow_up_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize)]
pub struct LeadDetail {
    pub id: uuid::Uuid,
    pub contact_name: String,
    pub phone_number: String,
    pub wechat_id: Option<String>,
    pub child_name: Option<String>,
    pub child_age: Option<i32>,
    pub child_grade: Option<String>,
    pub source: Option<String>,
    pub status: String,
    pub quality_score: Option<i32>,
    pub assigned_to: Option<uuid::Uuid>,
    pub assigned_to_name: Option<String>,
    pub last_contact_at: Option<chrono::DateTime<chrono::Utc>>,
    pub next_follow_up_at: Option<chrono::DateTime<chrono::Utc>>,
    pub notes: Option<String>,
    pub tags: Option<Vec<String>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub follow_up_records: Vec<FollowUpRecord>,
}

#[derive(Serialize)]
pub struct FollowUpRecord {
    pub id: uuid::Uuid,
    pub follow_up_type: String,
    pub content: String,
    pub outcome: Option<String>,
    pub created_by_name: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Deserialize)]
pub struct CreateLeadPayload {
    pub contact_name: String,
    pub phone_number: String,
    pub wechat_id: Option<String>,
    pub child_name: Option<String>,
    pub child_age: Option<i32>,
    pub child_grade: Option<String>,
    pub source: Option<String>,
    pub quality_score: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateLeadPayload {
    pub status: Option<String>,
    pub quality_score: Option<i32>,
    pub assigned_to: Option<uuid::Uuid>,
    pub next_follow_up_at: Option<chrono::DateTime<chrono::Utc>>,
    pub notes: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Deserialize)]
pub struct AddFollowUpPayload {
    pub follow_up_type: String,  // call/wechat/visit/email
    pub content: String,
    pub outcome: Option<String>,  // positive/neutral/negative/no_answer
    pub next_follow_up_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Deserialize)]
pub struct LeadQuery {
    pub status: Option<String>,
    pub assigned_to: Option<uuid::Uuid>,
    pub page: Option<i32>,
    pub limit: Option<i32>,
}

// ==========================================
// 2. API Handlers
// ==========================================

// GET /api/v1/base/leads - 获取线索列表
pub async fn get_leads_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(params): Query<LeadQuery>,
) -> Result<Json<Vec<LeadItem>>, StatusCode> {
    // Check if user is base principal/admin
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;
    
    let page = params.page.unwrap_or(1);
    let limit = params.limit.unwrap_or(20);
    let offset = (page - 1) * limit;

    let leads = sqlx::query_as::<_, (
        uuid::Uuid, String, String, Option<String>, Option<i32>, 
        Option<String>, String, Option<i32>, Option<String>,
        Option<chrono::DateTime<chrono::Utc>>, Option<chrono::DateTime<chrono::Utc>>,
        chrono::DateTime<chrono::Utc>
    )>(
        r#"
        SELECT 
            l.id, l.contact_name, l.phone_number, l.child_name, l.child_age,
            l.source, l.status, l.quality_score, u.full_name as assigned_to_name,
            l.last_contact_at, l.next_follow_up_at, l.created_at
        FROM leads l
        LEFT JOIN users u ON l.assigned_to = u.id
        WHERE l.base_id = $1
        AND ($2::text IS NULL OR l.status = $2::text)
        AND ($3::uuid IS NULL OR l.assigned_to = $3::uuid)
        ORDER BY 
            CASE WHEN l.next_follow_up_at IS NOT NULL THEN 0 ELSE 1 END,
            l.next_follow_up_at ASC,
            l.created_at DESC
        LIMIT $4 OFFSET $5
        "#
    )
    .bind(base_id)
    .bind(params.status)
    .bind(params.assigned_to)
    .bind(limit as i64)
    .bind(offset as i64)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch leads: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let result = leads.into_iter().map(|(
        id, contact_name, phone_number, child_name, child_age,
        source, status, quality_score, assigned_to_name,
        last_contact_at, next_follow_up_at, created_at
    )| LeadItem {
        id,
        contact_name,
        phone_number,
        child_name,
        child_age,
        source,
        status,
        quality_score,
        assigned_to_name,
        last_contact_at,
        next_follow_up_at,
        created_at,
    }).collect();

    Ok(Json(result))
}

// POST /api/v1/base/leads - 创建线索
pub async fn create_lead_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateLeadPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;
    let hq_id = claims.hq_id;
    let user_id = uuid::Uuid::parse_str(&claims.sub).unwrap_or_default();

    let lead_id = sqlx::query_scalar::<_, uuid::Uuid>(
        r#"
        INSERT INTO leads (
            hq_id, base_id, contact_name, phone_number, wechat_id,
            child_name, child_age, child_grade, source, quality_score,
            notes, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'new', $12)
        RETURNING id
        "#
    )
    .bind(hq_id)
    .bind(base_id)
    .bind(&payload.contact_name)
    .bind(&payload.phone_number)
    .bind(&payload.wechat_id)
    .bind(&payload.child_name)
    .bind(payload.child_age)
    .bind(&payload.child_grade)
    .bind(&payload.source)
    .bind(payload.quality_score)
    .bind(&payload.notes)
    .bind(user_id)
    .fetch_one(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create lead: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({
        "id": lead_id,
        "message": "线索创建成功"
    })))
}

// GET /api/v1/base/leads/:id - 获取线索详情
pub async fn get_lead_detail_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(lead_id): Path<uuid::Uuid>,
) -> Result<Json<LeadDetail>, StatusCode> {
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;

    // Get basic lead details (first query - 12 fields max)
    let lead_row = sqlx::query_as::<_, (
        uuid::Uuid, String, String, Option<String>, Option<String>, Option<i32>,
        Option<String>, Option<String>, String, Option<i32>, Option<uuid::Uuid>,
        Option<String>
    )>(
        r#"
        SELECT 
            l.id, l.contact_name, l.phone_number, l.wechat_id, l.child_name,
            l.child_age, l.child_grade, l.source, l.status, l.quality_score,
            l.assigned_to, u.full_name as assigned_to_name
        FROM leads l
        LEFT JOIN users u ON l.assigned_to = u.id
        WHERE l.id = $1 AND l.base_id = $2
        "#
    )
    .bind(lead_id)
    .bind(base_id)
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch lead detail: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    // Get additional fields (second query)
    let lead_extra = sqlx::query_as::<_, (
        Option<chrono::DateTime<chrono::Utc>>, 
        Option<chrono::DateTime<chrono::Utc>>, 
        Option<String>, 
        Option<Vec<String>>,
        chrono::DateTime<chrono::Utc>
    )>(
        r#"
        SELECT 
            last_contact_at, next_follow_up_at, notes, tags, created_at
        FROM leads
        WHERE id = $1
        "#
    )
    .bind(lead_id)
    .fetch_one(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Get follow-up records
    let follow_ups = sqlx::query_as::<_, (
        uuid::Uuid, String, String, Option<String>, String, chrono::DateTime<chrono::Utc>
    )>(
        r#"
        SELECT 
            f.id, f.follow_up_type, f.content, f.outcome,
            u.full_name as created_by_name, f.created_at
        FROM follow_up_records f
        JOIN users u ON f.created_by = u.id
        WHERE f.lead_id = $1
        ORDER BY f.created_at DESC
        "#
    )
    .bind(lead_id)
    .fetch_all(&state.db_pool)
    .await
    .unwrap_or(vec![]);

    let follow_up_records = follow_ups.into_iter().map(|(
        id, follow_up_type, content, outcome, created_by_name, created_at
    )| FollowUpRecord {
        id,
        follow_up_type,
        content,
        outcome,
        created_by_name,
        created_at,
    }).collect();

    Ok(Json(LeadDetail {
        id: lead_row.0,
        contact_name: lead_row.1,
        phone_number: lead_row.2,
        wechat_id: lead_row.3,
        child_name: lead_row.4,
        child_age: lead_row.5,
        child_grade: lead_row.6,
        source: lead_row.7,
        status: lead_row.8,
        quality_score: lead_row.9,
        assigned_to: lead_row.10,
        assigned_to_name: lead_row.11,
        last_contact_at: lead_extra.0,
        next_follow_up_at: lead_extra.1,
        notes: lead_extra.2,
        tags: lead_extra.3,
        created_at: lead_extra.4,
        follow_up_records,
    }))
}

// PUT /api/v1/base/leads/:id - 更新线索
pub async fn update_lead_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(lead_id): Path<uuid::Uuid>,
    Json(payload): Json<UpdateLeadPayload>,
) -> Result<StatusCode, StatusCode> {
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;

    sqlx::query(
        r#"
        UPDATE leads SET
            status = COALESCE($1, status),
            quality_score = COALESCE($2, quality_score),
            assigned_to = COALESCE($3, assigned_to),
            next_follow_up_at = COALESCE($4, next_follow_up_at),
            notes = COALESCE($5, notes),
            tags = COALESCE($6, tags)
        WHERE id = $7 AND base_id = $8
        "#
    )
    .bind(&payload.status)
    .bind(payload.quality_score)
    .bind(payload.assigned_to)
    .bind(payload.next_follow_up_at)
    .bind(&payload.notes)
    .bind(&payload.tags)
    .bind(lead_id)
    .bind(base_id)
    .execute(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update lead: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(StatusCode::OK)
}

// POST /api/v1/base/leads/:id/follow-up - 添加跟进记录
pub async fn add_follow_up_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(lead_id): Path<uuid::Uuid>,
    Json(payload): Json<AddFollowUpPayload>,
) -> Result<StatusCode, StatusCode> {
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;
    let user_id = uuid::Uuid::parse_str(&claims.sub).unwrap_or_default();

    // Verify lead belongs to this base
    let lead_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM leads WHERE id = $1 AND base_id = $2)"
    )
    .bind(lead_id)
    .bind(base_id)
    .fetch_one(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !lead_exists {
        return Err(StatusCode::NOT_FOUND);
    }

    // Insert follow-up record
    sqlx::query(
        r#"
        INSERT INTO follow_up_records (
            lead_id, follow_up_type, content, outcome, 
            next_follow_up_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6)
        "#
    )
    .bind(lead_id)
    .bind(&payload.follow_up_type)
    .bind(&payload.content)
    .bind(&payload.outcome)
    .bind(payload.next_follow_up_at)
    .bind(user_id)
    .execute(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to add follow-up: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Update lead's last_contact_at and next_follow_up_at
    sqlx::query(
        r#"
        UPDATE leads SET
            last_contact_at = CURRENT_TIMESTAMP,
            next_follow_up_at = $1
        WHERE id = $2
        "#
    )
    .bind(payload.next_follow_up_at)
    .bind(lead_id)
    .execute(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::CREATED)
}
