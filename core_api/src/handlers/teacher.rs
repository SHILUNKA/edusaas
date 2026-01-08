/*
 * src/handlers/teacher.rs
 * 职责: 教师 (Teacher) 管理
 * (★ V2 - 基地安全加固版 ★)
 */

use axum::{extract::State, http::StatusCode, Json};
use uuid::Uuid;
// use chrono::{DateTime, Utc}; // Removed unused

// 【修改】导入 AppState 和 Claims
use super::AppState;
// 导入 models
use crate::models::{Claims, Teacher};

// (GET /api/v1/base/teachers - 获取 "本基地" 可用的教师列表)
// (★ V2 - 基地安全加固 ★)
pub async fn get_base_teachers_handler(
    State(state): State<AppState>,
    claims: Claims, // <-- 【修改】必须出示“钥匙”
) -> Result<Json<Vec<Teacher>>, StatusCode> {

    let hq_id = claims.hq_id;

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
        WHERE t.hq_id = $1 AND t.base_id = $2 AND t.is_active = true
        "#,
    )
    .bind(hq_id) // <-- 【修改】绑定“钥匙”中的ID
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

// GET /api/v1/teacher/dashboard
pub async fn get_teacher_dashboard_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<crate::models::TeacherDashboardResponse>, StatusCode> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;

    // 1. 获取教师 ID (可选，非教务岗可能没有此记录)
    let teacher_id: Option<Uuid> = sqlx::query_scalar!(
        "SELECT user_id FROM teachers WHERE user_id = $1 AND base_id = $2",
        user_id,
        base_id
    )
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Database error checking teacher for user {}: {}", user_id, e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 2. 获取统计数据
    let mut today_class_count = 0;
    let mut month_lesson_count = 0;
    let mut upcoming_classes = Vec::new();

    if let Some(tid) = teacher_id {
        // 今日课程数
        today_class_count = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*) FROM classes c
            JOIN class_teachers ct ON c.id = ct.class_id
            WHERE ct.teacher_id = $1 AND c.start_time >= CURRENT_DATE AND c.start_time < CURRENT_DATE + INTERVAL '1 day'
            "#,
            tid
        )
        .fetch_one(&state.db_pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .unwrap_or(0);

        // 本月消课数
        month_lesson_count = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*) FROM classes c
            JOIN class_teachers ct ON c.id = ct.class_id
            WHERE ct.teacher_id = $1 AND c.start_time >= date_trunc('month', CURRENT_DATE) 
            AND c.start_time < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
            "#,
            tid
        )
        .fetch_one(&state.db_pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .unwrap_or(0);

        // 即将开始的课程
        upcoming_classes = sqlx::query_as::<_, crate::models::UpcomingClass>(
            r#"
            SELECT 
                c.id,
                co.name as course_name,
                c.start_time,
                c.end_time,
                r.name as room_name,
                c.max_capacity,
                (SELECT COUNT(*) FROM class_enrollments ce WHERE ce.class_id = c.id) as enrolled_count
            FROM classes c
            JOIN class_teachers ct ON c.id = ct.class_id
            JOIN courses co ON c.course_id = co.id
            JOIN rooms r ON c.room_id = r.id
            WHERE ct.teacher_id = $1 AND c.end_time > NOW()
            ORDER BY c.start_time ASC
            LIMIT 5
            "#
        )
        .bind(tid)
        .fetch_all(&state.db_pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    // 待跟进线索 (这属于 User 职能，不依赖老师档案)
    let pending_leads_count = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM leads WHERE assigned_to = $1 AND status IN ('new', 'following')",
        user_id
    )
    .fetch_one(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .unwrap_or(0);

    Ok(Json(crate::models::TeacherDashboardResponse {
        stats: crate::models::TeacherDashboardStats {
            today_class_count: today_class_count as i64,
            pending_leads_count: pending_leads_count as i64,
            month_lesson_count: month_lesson_count as i64,
        },
        upcoming_classes,
    }))
}