/*
 * src/handlers/trial_class.rs
 * 职责: 试听课管理 - Trial Class Management for Base Admin
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
pub struct TrialClassItem {
    pub id: uuid::Uuid,
    pub base_id: uuid::Uuid,
    pub lead_id: Option<uuid::Uuid>,
    pub student_name: String,
    pub student_age: Option<i32>,
    pub student_grade: Option<String>,
    pub parent_name: String,
    pub parent_phone: String,
    pub parent_wechat: Option<String>,
    pub scheduled_at: String, // ISO 8601
    pub duration: i32,
    pub teacher_id: Option<uuid::Uuid>,
    pub teacher_name: Option<String>,
    pub classroom: Option<String>,
    pub course_type: Option<String>,
    pub status: String,
    pub student_performance: Option<i32>,
    pub parent_satisfaction: Option<i32>,
   pub conversion_intent: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct CreateTrialClassPayload {
    pub lead_id: Option<uuid::Uuid>,
    pub student_name: String,
    pub student_age: Option<i32>,
    pub student_grade: Option<String>,
    pub parent_name: String,
    pub parent_phone: String,
    pub parent_wechat: Option<String>,
    pub scheduled_at: String, // ISO 8601 format
    pub duration: Option<i32>,
    pub teacher_id: Option<uuid::Uuid>,
    pub classroom: Option<String>,
    pub course_type: Option<String>,
    pub notes: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateTrialClassPayload {
    pub scheduled_at: Option<String>,
    pub duration: Option<i32>,
    pub teacher_id: Option<uuid::Uuid>,
    pub classroom: Option<String>,
    pub course_type: Option<String>,
    pub status: Option<String>,
    pub notes: Option<String>,
}

#[derive(Deserialize)]
pub struct TrialClassFeedback {
    pub feedback: String,
    pub student_performance: i32,
    pub parent_satisfaction: i32,
    pub conversion_intent: String,
}

#[derive(Deserialize)]
pub struct TrialClassQuery {
    pub status: Option<String>,
}

// ==========================================
// 2. API Handlers
// ==========================================

// GET /api/v1/base/trial-classes - 获取试听课列表
pub async fn get_trial_classes_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(params): Query<TrialClassQuery>,
) -> Result<Json<Vec<TrialClassItem>>, StatusCode> {
    // 检查权限：必须是基地角色
    if !claims.roles.iter().any(|r| r.starts_with("role.base.")) {
        return Err(StatusCode::FORBIDDEN);
    }

    // 获取 base_id
    let base_id = match claims.base_id {
        Some(id) => id,
        None => return Err(StatusCode::FORBIDDEN),
    };

    #[derive(sqlx::FromRow)]
    struct TrialClassRow {
        id: uuid::Uuid,
        base_id: uuid::Uuid,
        lead_id: Option<uuid::Uuid>,
        student_name: String,
        student_age: Option<i32>,
        student_grade: Option<String>,
        parent_name: String,
        parent_phone: String,
        parent_wechat: Option<String>,
        scheduled_at: chrono::DateTime<chrono::Utc>,
        duration: i32,
        teacher_id: Option<uuid::Uuid>,
        teacher_name: Option<String>,
        classroom: Option<String>,
        course_type: Option<String>,
        status: String,
        student_performance: Option<i32>,
        parent_satisfaction: Option<i32>,
        conversion_intent: Option<String>,
        notes: Option<String>,
        created_at: chrono::DateTime<chrono::Utc>,
    }

    let rows = if let Some(ref status_val) = params.status {
       sqlx::query_as::<_, TrialClassRow>(
            r#"
            SELECT 
                tc.id, tc.base_id, tc.lead_id,
                tc.student_name, tc.student_age, tc.student_grade,
                tc.parent_name, tc.parent_phone, tc.parent_wechat,
                tc.scheduled_at, tc.duration, tc.teacher_id,
                u.full_name as teacher_name,
                tc.classroom, tc.course_type, tc.status,
                tc.student_performance, tc.parent_satisfaction,
                tc.conversion_intent, tc.notes, tc.created_at
            FROM trial_classes tc
            LEFT JOIN users u ON tc.teacher_id = u.id
            WHERE tc.base_id = $1 AND tc.status = $2
            ORDER BY tc.scheduled_at DESC
            "#
        )
        .bind(base_id)
        .bind(status_val)
        .fetch_all(&state.db_pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else {
        sqlx::query_as::<_, TrialClassRow>(
            r#"
            SELECT 
                tc.id, tc.base_id, tc.lead_id,
                tc.student_name, tc.student_age, tc.student_grade,
                tc.parent_name, tc.parent_phone, tc.parent_wechat,
                tc.scheduled_at, tc.duration, tc.teacher_id,
                u.full_name as teacher_name,
                tc.classroom, tc.course_type, tc.status,
                tc.student_performance, tc.parent_satisfaction,
                tc.conversion_intent, tc.notes, tc.created_at
            FROM trial_classes tc
            LEFT JOIN users u ON tc.teacher_id = u.id
            WHERE tc.base_id = $1
            ORDER BY tc.scheduled_at DESC
            "#
        )
        .bind(base_id)
        .fetch_all(&state.db_pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    let trial_classes: Vec<TrialClassItem> = rows
        .into_iter()
        .map(|row| TrialClassItem {
            id: row.id,
            base_id: row.base_id,
            lead_id: row.lead_id,
            student_name: row.student_name,
            student_age: row.student_age,
            student_grade: row.student_grade,
            parent_name: row.parent_name,
            parent_phone: row.parent_phone,
            parent_wechat: row.parent_wechat,
            scheduled_at: row.scheduled_at.to_rfc3339(),
            duration: row.duration,
            teacher_id: row.teacher_id,
            teacher_name: row.teacher_name,
            classroom: row.classroom,
            course_type: row.course_type,
            status: row.status,
            student_performance: row.student_performance,
            parent_satisfaction: row.parent_satisfaction,
            conversion_intent: row.conversion_intent,
            notes: row.notes,
            created_at: row.created_at.to_rfc3339(),
        })
        .collect();

    Ok(Json(trial_classes))
}

// POST /api/v1/base/trial-classes - 创建试听课
pub async fn create_trial_class_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateTrialClassPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if !claims.roles.iter().any(|r| r.starts_with("role.base.")) {
        return Err(StatusCode::FORBIDDEN);
    }

    let base_id = match claims.base_id {
        Some(id) => id,
        None => return Err(StatusCode::FORBIDDEN),
    };

    // 解析 scheduled_at
    let scheduled_at = chrono::DateTime::parse_from_rfc3339(&payload.scheduled_at)
        .map_err(|_| StatusCode::BAD_REQUEST)?
        .with_timezone(&chrono::Utc);

    let trial_class_id = uuid::Uuid::new_v4();

    // Create trial class
    sqlx::query!(
        r#"
        INSERT INTO trial_classes (
            id, base_id, lead_id, student_name, student_age, student_grade,
            parent_name, parent_phone, parent_wechat,
            scheduled_at, duration, teacher_id, classroom, course_type,
            status, notes, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        "#,
        trial_class_id,
        base_id,
        payload.lead_id,
        payload.student_name,
        payload.student_age,
        payload.student_grade,
        payload.parent_name,
        payload.parent_phone,
        payload.parent_wechat,
        scheduled_at,
        payload.duration.unwrap_or(60),
        payload.teacher_id,
        payload.classroom,
        payload.course_type,
        "pending",
        payload.notes,
        uuid::Uuid::parse_str(&claims.sub).unwrap_or_default()
    )
    .execute(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Auto-create customer if not exists
    let existing_customer = sqlx::query!(
        "SELECT id FROM customers WHERE phone_number = $1 AND base_id = $2",
        payload.parent_phone,
        base_id
    )
    .fetch_optional(&state.db_pool)
    .await
    .unwrap_or(None);

    if existing_customer.is_none() {
        let new_customer_id = uuid::Uuid::new_v4();
        // Use a safe default for customer_type if not provided in DB default
        let _ = sqlx::query!(
            r#"
            INSERT INTO customers (
                id, hq_id, base_id, name, phone_number, wechat_openid, 
                customer_type, lead_source, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'prospect', 'trial_class', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            "#,
            new_customer_id,
            claims.hq_id,
            base_id,
            payload.parent_name,
            payload.parent_phone,
            payload.parent_wechat
        )
        .execute(&state.db_pool)
        .await;
        // We log error but don't fail the request if customer creation fails
    }

    Ok(Json(serde_json::json!({
        "id": trial_class_id,
        "message": "Trial class created successfully"
    })))
}

// GET /api/v1/base/trial-classes/:id - 获取试听课详情
pub async fn get_trial_class_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(trial_class_id): Path<uuid::Uuid>,
) -> Result<Json<TrialClassItem>, StatusCode> {
    let row = sqlx::query!(
        r#"
        SELECT 
            tc.id as "id!: uuid::Uuid",
            tc.base_id as "base_id!: uuid::Uuid",
            tc.lead_id as "lead_id: uuid::Uuid",
            tc.student_name,
            tc.student_age,
            tc.student_grade,
            tc.parent_name,
            tc.parent_phone,
            tc.parent_wechat,
            tc.scheduled_at,
            tc.duration,
            tc.teacher_id as "teacher_id: uuid::Uuid",
            u.full_name as teacher_name,
            tc.classroom,
            tc.course_type,
            tc.status,
            tc.student_performance,
            tc.parent_satisfaction,
            tc.conversion_intent,
            tc.notes,
            tc.created_at
        FROM trial_classes tc
        LEFT JOIN users u ON tc.teacher_id = u.id
        WHERE tc.id = $1
        "#,
        trial_class_id
    )
    .fetch_one(&state.db_pool)
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(TrialClassItem {
        id: row.id,
        base_id: row.base_id,
        lead_id: row.lead_id,
        student_name: row.student_name,
        student_age: row.student_age,
        student_grade: row.student_grade,
        parent_name: row.parent_name,
        parent_phone: row.parent_phone,
        parent_wechat: row.parent_wechat,
        scheduled_at: row.scheduled_at.to_rfc3339(),
        duration: row.duration.unwrap_or(60),
        teacher_id: row.teacher_id,
        teacher_name: row.teacher_name,
        classroom: row.classroom,
        course_type: row.course_type,
        status: row.status,
        student_performance: row.student_performance,
        parent_satisfaction: row.parent_satisfaction,
        conversion_intent: row.conversion_intent,
        notes: row.notes,
        created_at: row.created_at.unwrap_or_else(chrono::Utc::now).to_rfc3339(),
    }))
}

// PUT /api/v1/base/trial-classes/:id - 更新试听课
pub async fn update_trial_class_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(trial_class_id): Path<uuid::Uuid>,
    Json(payload): Json<UpdateTrialClassPayload>,
) -> Result<StatusCode, StatusCode> {
    let scheduled_at = if let Some(ref dt_str) = payload.scheduled_at {
        Some(
            chrono::DateTime::parse_from_rfc3339(dt_str)
                .map_err(|_| StatusCode::BAD_REQUEST)?
                .with_timezone(&chrono::Utc),
        )
    } else {
        None
    };

    sqlx::query!(
        r#"
        UPDATE trial_classes
        SET scheduled_at = COALESCE($1, scheduled_at),
            duration = COALESCE($2, duration),
            teacher_id = COALESCE($3, teacher_id),
            classroom = COALESCE($4, classroom),
            course_type = COALESCE($5, course_type),
            status = COALESCE($6, status),
            notes = COALESCE($7, notes),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $8
        "#,
        scheduled_at,
        payload.duration,
        payload.teacher_id,
        payload.classroom,
        payload.course_type,
        payload.status,
        payload.notes,
        trial_class_id
    )
    .execute(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

// POST /api/v1/base/trial-classes/:id/feedback - 添加反馈
pub async fn add_trial_class_feedback_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(trial_class_id): Path<uuid::Uuid>,
    Json(payload): Json<TrialClassFeedback>,
) -> Result<StatusCode, StatusCode> {
    // 1. Update trial class feedback and status
    sqlx::query!(
        r#"
        UPDATE trial_classes
        SET feedback = $1,
            student_performance = $2,
            parent_satisfaction = $3,
            conversion_intent = $4,
            status = 'completed',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        "#,
        payload.feedback,
        payload.student_performance,
        payload.parent_satisfaction,
        payload.conversion_intent,
        trial_class_id
    )
    .execute(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 2. If conversion intent is high or medium, try to convert lead to customer
    if payload.conversion_intent == "high" || payload.conversion_intent == "medium" {
        // Fetch trial class details to get student/parent info
        let trial_class = sqlx::query!(
            r#"
            SELECT base_id, lead_id, parent_name, parent_phone, parent_wechat
            FROM trial_classes
            WHERE id = $1
            "#,
            trial_class_id
        )
        .fetch_optional(&state.db_pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        if let Some(tc) = trial_class {
            // Check if customer already exists by phone
            let existing_customer_id = sqlx::query_scalar::<_, uuid::Uuid>(
                "SELECT id FROM customers WHERE phone_number = $1 AND base_id = $2"
            )
            .bind(&tc.parent_phone)
            .bind(tc.base_id)
            .fetch_optional(&state.db_pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

            let customer_id = if let Some(id) = existing_customer_id {
                id
            } else {
                // Create new customer
                let new_customer_id = uuid::Uuid::new_v4();
                sqlx::query!(
                    r#"
                    INSERT INTO customers (id, hq_id, base_id, name, phone_number, wechat_openid, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    "#,
                    new_customer_id,
                    claims.hq_id,
                    tc.base_id,
                    tc.parent_name,
                    tc.parent_phone,
                    tc.parent_wechat
                )
                .execute(&state.db_pool)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
                
                new_customer_id
            };

            // If linked to a lead, update the lead status
            if let Some(lead_id) = tc.lead_id {
                sqlx::query!(
                    r#"
                    UPDATE leads 
                    SET status = 'converted', 
                        converted_to_customer_id = $1, 
                        converted_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2 AND converted_to_customer_id IS NULL
                    "#,
                    customer_id,
                    lead_id
                )
                .execute(&state.db_pool)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            }
        }
    }

    Ok(StatusCode::OK)
}
