/*
 * src/handlers/course.rs
 * 职责: 课程 (Course) 管理
 * (★ V3 - 角色安全加固版 ★)
 */

use axum::{extract::State, http::StatusCode, Json};


// 【修改】导入 AppState 和 Claims
use super::AppState;
use super::auth::Claims; // <-- 我们需要“钥匙”
// 导入 models
use crate::models::{Course, CreateCoursePayload};


// (GET /api/v1/courses - 获取所有课程)
// (★ V2 - SaaS 安全加固 ★)
pub async fn get_courses_handler(
    State(state): State<AppState>,
    claims: Claims, // <-- 必须出示“钥匙”
) -> Result<Json<Vec<Course>>, StatusCode> {
    
    let tenant_id = claims.tenant_id; // <-- 使用“钥匙”中的租户ID

    let courses = match sqlx::query_as::<_, Course>(
        r#"
        SELECT * FROM courses
        WHERE tenant_id = $1
        ORDER BY name_key ASC
        "#,
    )
    .bind(tenant_id) // <-- 绑定“钥匙”中的ID
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(courses) => courses,
        Err(e) => {
            tracing::error!("Failed to fetch courses: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(courses))
}

// (POST /api/v1/courses - 创建一个新课程)
// (★ V3 - 角色安全加固 ★)
pub async fn create_course_handler(
    State(state): State<AppState>,
    claims: Claims, // <-- 必须出示“钥匙”
    Json(payload): Json<CreateCoursePayload>,
) -> Result<Json<Course>, StatusCode> {
    
    // --- (★ 新增：角色安全守卫 ★) ---
    // 检查“钥匙”中的角色列表是否包含“租户管理员”
    // (我们假设 'role.tenant.admin' 是您在 psql 中为 'hq@tenant.com' 设置的角色)
    let is_authorized = claims.roles.iter().any(|role| 
        role == "role.tenant.admin"
    );

    if !is_authorized {
        tracing::warn!(
            "Unauthorized attempt to create course by user {} (roles: {:?})",
            claims.sub,
            claims.roles
        );
        // 403 Forbidden: "我认识你(Token有效)，但你没有权限(Role不对)"
        return Err(StatusCode::FORBIDDEN);
    }
    // --- (守卫结束) ---


    // (HACK 已移除!)
    let tenant_id = claims.tenant_id; // <-- 使用“钥匙”中的租户ID

    let new_course = match sqlx::query_as::<_, Course>(
        r#"
        INSERT INTO courses (
            tenant_id, name_key, description_key, target_audience_key,
            default_duration_minutes, points_awarded, prerequisite_course_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        "#,
    )
    .bind(tenant_id) // <-- 绑定“钥匙”中的ID
    .bind(&payload.name_key)
    .bind(payload.description_key)
    .bind(payload.target_audience_key)
    .bind(payload.default_duration_minutes.unwrap_or(60))
    .bind(payload.points_awarded.unwrap_or(0))
    .bind(payload.prerequisite_course_id)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(course) => course,
        Err(e) => {
            tracing::error!("Failed to create course: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(new_course))
}