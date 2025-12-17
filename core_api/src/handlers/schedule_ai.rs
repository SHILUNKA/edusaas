/*
 * src/handlers/schedule_ai.rs
 * 职责: 智能排课 (AI Bridge) & 教师配置
 * (★ V13.5 - 修复 DateTime 导入缺失 ★)
 */
use axum::{extract::{State, Path}, http::StatusCode, Json};
use uuid::Uuid;
use serde::{Deserialize, Serialize};
use serde_json::json;
// (★ 修复: 添加 DateTime)
use chrono::{Datelike, Utc, DateTime}; 


use super::AppState;
use crate::models::{
    Claims,
    TeacherSkill, TeacherAvailability, 
    UpdateTeacherSkillsPayload, CreateAvailabilityPayload
};

// --- AI 通信使用的临时结构体 ---
#[derive(Serialize)]
struct AiRequest {
    base_id: Uuid,
    start_date: String,
    teachers: Vec<AiTeacher>,
    courses: Vec<AiCourse>,
    rooms: Vec<AiRoom>,
    density: i32,
}
#[derive(Serialize)]
struct AiTeacher { id: Uuid, name: String, skills: Vec<Uuid>, availability: Vec<TeacherAvailability> }
#[derive(Serialize)]
struct AiCourse { id: Uuid, name: String, duration: i32 }
#[derive(Serialize)]
struct AiRoom { id: Uuid, name: String, capacity: i32 }

#[derive(Deserialize)]
struct AiResponse {
    results: Vec<AiResultClass>,
}
#[derive(Deserialize)]
struct AiResultClass {
    course_id: Uuid,
    teacher_id: Uuid,
    room_id: Uuid,
    start_time: String, 
    end_time: String,   
}

// 1. (GET) 获取老师配置
pub async fn get_teacher_config_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(teacher_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let _ = claims.hq_id;

    let skills = sqlx::query_as::<_, TeacherSkill>(
        r#"SELECT tqc.course_id, c.name_key as course_name FROM teacher_qualified_courses tqc JOIN courses c ON tqc.course_id = c.id WHERE tqc.teacher_id = $1"#
    ).bind(teacher_id).fetch_all(&state.db_pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let availability = sqlx::query_as::<_, TeacherAvailability>(
        r#"SELECT * FROM teacher_availability WHERE teacher_id = $1 ORDER BY day_of_week ASC, start_time ASC"#
    ).bind(teacher_id).fetch_all(&state.db_pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!({ "skills": skills, "availability": availability })))
}

// 2. (PUT) 更新技能
pub async fn update_teacher_skills_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(teacher_id): Path<Uuid>,
    Json(payload): Json<UpdateTeacherSkillsPayload>,
) -> Result<StatusCode, StatusCode> {
    if !claims.roles.iter().any(|r| r.contains("admin")) { return Err(StatusCode::FORBIDDEN); }
    let mut tx = state.db_pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    sqlx::query("DELETE FROM teacher_qualified_courses WHERE teacher_id = $1").bind(teacher_id).execute(&mut *tx).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    for course_id in payload.course_ids {
        sqlx::query("INSERT INTO teacher_qualified_courses (teacher_id, course_id) VALUES ($1, $2)").bind(teacher_id).bind(course_id).execute(&mut *tx).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }
    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::OK)
}

// 3. (POST) 新增时间
pub async fn add_teacher_availability_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(teacher_id): Path<Uuid>,
    Json(payload): Json<CreateAvailabilityPayload>,
) -> Result<StatusCode, StatusCode> {
    let start = chrono::NaiveTime::parse_from_str(&payload.start_time, "%H:%M").map_err(|_| StatusCode::BAD_REQUEST)?;
    let end = chrono::NaiveTime::parse_from_str(&payload.end_time, "%H:%M").map_err(|_| StatusCode::BAD_REQUEST)?;
    sqlx::query("INSERT INTO teacher_availability (teacher_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4)")
        .bind(teacher_id).bind(payload.day_of_week).bind(start).bind(end).execute(&state.db_pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::CREATED)
}

// 4. (DELETE) 删除时间
pub async fn delete_teacher_availability_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(availability_id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query("DELETE FROM teacher_availability WHERE id = $1").bind(availability_id).execute(&state.db_pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}

// 5. (POST) ★ 核心: 触发 AI 自动排课
pub async fn trigger_auto_schedule_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<serde_json::Value>, StatusCode> {
    
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;
    let hq_id = claims.hq_id;

    // --- A. 数据准备 ---
    
    // 1. 课程
    let courses = sqlx::query_as!(
        AiCourse,
        "SELECT id, name_key as name, default_duration_minutes as duration FROM courses WHERE hq_id = $1 AND is_active = true",
        hq_id
    ).fetch_all(&state.db_pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 2. 教室 (使用 COALESCE 和 as "capacity!" 强制非空)
    let rooms = sqlx::query_as!(
        AiRoom,
        r#"SELECT id, name, COALESCE(capacity, 10) as "capacity!" FROM rooms WHERE base_id = $1"#,
        base_id
    ).fetch_all(&state.db_pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 3. 老师
    let raw_teachers = sqlx::query!(
        "SELECT t.user_id as id, u.full_name as name FROM teachers t JOIN users u ON t.user_id = u.id WHERE t.base_id = $1 AND t.is_active = true",
        base_id
    ).fetch_all(&state.db_pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut ai_teachers = Vec::new();
    for t in raw_teachers {
        let skills: Vec<Uuid> = sqlx::query_scalar(
            "SELECT course_id FROM teacher_qualified_courses WHERE teacher_id = $1"
        ).bind(t.id).fetch_all(&state.db_pool).await.unwrap_or_default();
        
        let availability = sqlx::query_as::<_, TeacherAvailability>(
            "SELECT * FROM teacher_availability WHERE teacher_id = $1"
        ).bind(t.id).fetch_all(&state.db_pool).await.unwrap_or_default();

        ai_teachers.push(AiTeacher {
            id: t.id,
            name: t.name.unwrap_or_default(),
            skills,
            availability
        });
    }

    let today = Utc::now().date_naive();
    let days_from_monday = today.weekday().num_days_from_monday();
    let monday = today - chrono::Duration::days(days_from_monday as i64);

    // --- B. 调用 AI ---
    let payload = AiRequest {
        base_id,
        start_date: monday.to_string(),
        teachers: ai_teachers,
        courses,
        rooms,
        density: 3,
    };

    let client = reqwest::Client::new();
    let ai_res = client.post(format!("{}/schedule/generate", state.ai_api_url))
        .json(&payload)
        .send()
        .await
        .map_err(|e| {
            tracing::error!("AI Service unavailable: {}", e);
            StatusCode::BAD_GATEWAY
        })?;

    if !ai_res.status().is_success() {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    let ai_data: AiResponse = ai_res.json().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // --- C. 写入结果 ---
    let mut tx = state.db_pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut count = 0;

    for cls in ai_data.results {
        let start = DateTime::parse_from_rfc3339(&cls.start_time).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?.with_timezone(&Utc);
        let end = DateTime::parse_from_rfc3339(&cls.end_time).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?.with_timezone(&Utc);

        let class_id: Uuid = sqlx::query_scalar(
            r#"
            INSERT INTO classes (hq_id, base_id, course_id, room_id, start_time, end_time, max_capacity, status)
            VALUES ($1, $2, $3, $4, $5, $6, 10, 'scheduled')
            RETURNING id
            "#
        )
        .bind(hq_id)
        .bind(base_id)
        .bind(cls.course_id)
        .bind(cls.room_id)
        .bind(start)
        .bind(end)
        .fetch_one(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        sqlx::query("INSERT INTO class_teachers (class_id, teacher_id) VALUES ($1, $2)")
            .bind(class_id)
            .bind(cls.teacher_id)
            .execute(&mut *tx)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            
        count += 1;
    }

    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!({
        "status": "success",
        "classes_created": count,
        "message": format!("AI 成功生成了 {} 节排课", count)
    })))
}