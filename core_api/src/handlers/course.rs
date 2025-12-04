/*
 * src/handlers/course.rs
 * 职责: 课程 (Course) 管理
 * (★ V16.2 - Fix: 补充缺失的 Path, UpdateStatusPayload 导入 ★)
 */

use axum::{
    extract::{State, Path}, // (★ 修复: 添加 Path)
    http::StatusCode, 
    Json
};
use uuid::Uuid;

use super::{AppState, auth::Claims, toggle_status_common};
// (★ 修复: 添加 UpdateStatusPayload)
use crate::models::{Course, CreateCoursePayload, UpdateStatusPayload, UpdateCoursePayload};

// (GET)
pub async fn get_courses_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<Course>>, StatusCode> {
    let tenant_id = claims.tenant_id;
    let courses = sqlx::query_as::<_, Course>("SELECT * FROM courses WHERE tenant_id = $1 ORDER BY name_key ASC")
        .bind(tenant_id).fetch_all(&state.db_pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(courses))
}

pub async fn create_course_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateCoursePayload>,
) -> Result<Json<Course>, StatusCode> {
    if !claims.roles.contains(&"role.tenant.admin".to_string()) { return Err(StatusCode::FORBIDDEN); }
    
    let new_course = sqlx::query_as::<_, Course>(
        r#"
        INSERT INTO courses (
            tenant_id, name_key, description_key, target_audience_key,
            default_duration_minutes, points_awarded, prerequisite_course_id,
            cover_url, introduction
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        "#
    )
    .bind(claims.tenant_id)
    .bind(&payload.name_key)
    .bind(payload.description_key)
    .bind(payload.target_audience_key)
    .bind(payload.default_duration_minutes.unwrap_or(60))
    .bind(payload.points_awarded.unwrap_or(0))
    .bind(payload.prerequisite_course_id)
    .bind(payload.cover_url)    // (★)
    .bind(payload.introduction) // (★)
    .fetch_one(&state.db_pool).await.map_err(|e| {
        tracing::error!("Create course failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(new_course))
}

pub async fn update_course_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCoursePayload>,
) -> Result<Json<Course>, StatusCode> {
    if !claims.roles.contains(&"role.tenant.admin".to_string()) { return Err(StatusCode::FORBIDDEN); }

    let updated = sqlx::query_as::<_, Course>(
        r#"
        UPDATE courses SET 
            name_key = $1, description_key = $2, target_audience_key = $3,
            default_duration_minutes = $4, points_awarded = $5,
            cover_url = $6, introduction = $7
        WHERE id = $8 AND tenant_id = $9
        RETURNING *
        "#
    )
    .bind(&payload.name_key)
    .bind(payload.description_key)
    .bind(payload.target_audience_key)
    .bind(payload.default_duration_minutes)
    .bind(payload.points_awarded)
    .bind(payload.cover_url)
    .bind(payload.introduction)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_one(&state.db_pool).await.map_err(|e| {
        tracing::error!("Update course failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(updated))
}

// (PATCH)
pub async fn toggle_course_status_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateStatusPayload>,
) -> Result<StatusCode, StatusCode> {
    if !claims.roles.contains(&"role.tenant.admin".to_string()) { return Err(StatusCode::FORBIDDEN); }
    toggle_status_common(&state.db_pool, "courses", id, claims.tenant_id, payload.is_active).await
}