/*
 * src/handlers/schedule_ai.rs
 * 职责: 智能排课相关接口
 */
use axum::{extract::{State, Path}, http::StatusCode, Json};
use uuid::Uuid;
use serde_json::json;
use super::{AppState, auth::Claims};
use crate::models::{CreateAvailabilityPayload, TeacherQualificationPayload};

// 1. 设置老师能教的课
pub async fn set_teacher_qualifications(
    State(state): State<AppState>,
    claims: Claims,
    Path(teacher_id): Path<Uuid>,
    Json(payload): Json<TeacherQualificationPayload>,
) -> Result<StatusCode, StatusCode> {
    // (省略权限检查，假设只有校长能设)
    let mut tx = state.db_pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    // 先清空旧的
    sqlx::query("DELETE FROM teacher_qualified_courses WHERE teacher_id = $1")
        .bind(teacher_id).execute(&mut *tx).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    for course_id in payload.course_ids {
        sqlx::query("INSERT INTO teacher_qualified_courses (teacher_id, course_id) VALUES ($1, $2)")
            .bind(teacher_id).bind(course_id).execute(&mut *tx).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }
    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::OK)
}

// 2. 设置老师可用时间
pub async fn add_teacher_availability(
    State(state): State<AppState>,
    claims: Claims,
    Path(teacher_id): Path<Uuid>,
    Json(payload): Json<CreateAvailabilityPayload>,
) -> Result<StatusCode, StatusCode> {
    // 解析时间字符串
    let start = chrono::NaiveTime::parse_from_str(&payload.start_time, "%H:%M").map_err(|_| StatusCode::BAD_REQUEST)?;
    let end = chrono::NaiveTime::parse_from_str(&payload.end_time, "%H:%M").map_err(|_| StatusCode::BAD_REQUEST)?;

    sqlx::query("INSERT INTO teacher_availability (teacher_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4)")
        .bind(teacher_id).bind(payload.day_of_week).bind(start).bind(end)
        .execute(&state.db_pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        
    Ok(StatusCode::CREATED)
}

// 3. (核心) 触发 AI 自动排课
pub async fn trigger_auto_schedule(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;
    let tenant_id = claims.tenant_id;

    // A. 从数据库抓取所有排课所需数据 (老师、课程、教室、约束)
    // (这里简化处理，实际需要查询所有相关表并组装成大 JSON)
    // let teachers = ...
    // let courses = ...
    
    // B. 调用 Python AI 服务
    let ai_payload = json!({
        "tenant_id": tenant_id,
        "base_id": base_id,
        "week_start": "2025-11-24" // 示例
    });

    let client = reqwest::Client::new();
    let res = client.post(format!("{}/schedule/generate", state.ai_api_url))
        .json(&ai_payload)
        .send()
        .await
        .map_err(|e| {
            tracing::error!("AI call failed: {}", e);
            StatusCode::BAD_GATEWAY
        })?;

    if res.status().is_success() {
        let schedule_result: serde_json::Value = res.json().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        
        // C. (重要) AI 返回的是建议方案，我们需要解析并写入 `classes` 表
        // insert_schedule_to_db(&state.db_pool, schedule_result).await?;

        Ok(Json(schedule_result))
    } else {
        Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}