/*
 * src/handlers/teacher.rs
 * 职责: 教师 (Teacher) 管理
 * (★ V2 - 基地安全加固版 ★)
 */

use axum::{extract::State, http::StatusCode, Json};


// 【修改】导入 AppState 和 Claims
use super::AppState;
use super::auth::Claims; // <-- 我们需要“钥匙”
// 导入 models
use crate::models::Teacher;

// (GET /api/v1/base/teachers - 获取 "本基地" 可用的教师列表)
// (★ V2 - 基地安全加固 ★)
pub async fn get_base_teachers(
    State(state): State<AppState>,
    claims: Claims, // <-- 【修改】必须出示“钥匙”
) -> Result<Json<Vec<Teacher>>, StatusCode> {

    let tenant_id = claims.tenant_id;

    // (★ SaaS 逻辑 ★)
    // 基地员工必须有关联的 base_id 才能调用这个 API
    let base_id = match claims.base_id {
        Some(id) => id,
        None => {
            tracing::warn!("User {} without base_id tried to access base-specific teachers", claims.sub);
            return Err(StatusCode::FORBIDDEN); // 403 Forbidden
        }
    };

    let teachers = match sqlx::query_as::<_, Teacher>(
        r#"
        SELECT t.*, u.full_name 
        FROM teachers t
        JOIN users u ON t.user_id = u.id
        WHERE t.tenant_id = $1 AND t.base_id = $2 AND t.is_active = true
        "#,
    )
    .bind(tenant_id) // <-- 【修改】绑定“钥匙”中的ID
    .bind(base_id)   // <-- 【修改】绑定“钥匙”中的 base_id
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(teachers) => teachers,
        Err(e) => {
            tracing::error!("Failed to fetch base teachers: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    Ok(Json(teachers))
}