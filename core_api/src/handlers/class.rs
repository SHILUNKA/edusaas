/*
 * src/handlers/class.rs
 * 职责: 排课 (Class) 管理
 * (★ V4 - “JOIN 增强”版 ★)
 */

use axum::{
    extract::{State, Query, Path}, 
    http::StatusCode, 
    Json
};
use serde::Deserialize; 
use sqlx::{QueryBuilder, FromRow}; // <-- 【修改】导入 FromRow


// 【修改】导入 AppState 和 Claims
use super::AppState;
use super::auth::Claims; 
// 【修改】导入 Class, CreateClassPayload, 和我们新的 ClassDetail
use crate::models::{Class, CreateClassPayload, ClassDetail};

// --- 用于接收查询参数 (例如 ?date=today) ---
#[derive(Debug, Deserialize)]
pub struct GetClassesQuery {
    date: Option<String>,
}

// (GET /api/v1/base/classes - 获取 "本基地" 的排课)
// (★ V4 - “JOIN 增强”版 ★)
pub async fn get_base_classes(
    State(state): State<AppState>,
    claims: Claims, // <-- 必须出示“钥匙”
    Query(query): Query<GetClassesQuery>, // <-- 接收查询参数
) -> Result<Json<Vec<ClassDetail>>, StatusCode> { // <-- 【修改】返回类型为 ClassDetail

    let tenant_id = claims.tenant_id;

    // (★ SaaS 逻辑 ★)
    let base_id = match claims.base_id {
        Some(id) => id,
        None => {
            tracing::warn!("User {} without base_id tried to access base-specific classes", claims.sub);
            return Err(StatusCode::FORBIDDEN); // 403 Forbidden
        }
    };

    // --- (★ 关键: 动态 SQL 查询构建 ★) ---
    // (我们现在 SELECT 更多字段, 并执行 3 个 LEFT JOIN)
    let mut query_builder: QueryBuilder<sqlx::Postgres> = QueryBuilder::new(
        r#"
        SELECT 
            c.*, 
            co.name_key AS course_name_key,
            u.full_name AS teacher_name,
            r.name AS room_name
        FROM 
            classes c
        LEFT JOIN 
            courses co ON c.course_id = co.id
        LEFT JOIN 
            teachers t ON c.teacher_id = t.user_id
        LEFT JOIN 
            users u ON t.user_id = u.id
        LEFT JOIN 
            rooms r ON c.room_id = r.id
        WHERE 
            c.tenant_id = 
        "#
    );

    query_builder.push_bind(tenant_id);
    query_builder.push(" AND c.base_id = ");
    query_builder.push_bind(base_id);

    // (★ 关键: 检查 ?date=today)
    if let Some(date_filter) = query.date {
        if date_filter == "today" {
            // (我们使用 'CURRENT_DATE' 来获取数据库服务器的“今天”)
            // (注意: 我们现在必须使用 'c.start_time' 来指定表)
            query_builder.push(" AND c.start_time::date = CURRENT_DATE ");
            tracing::debug!("(LOG) Filtering classes for 'today'");
        }
    }

    query_builder.push(" ORDER BY c.start_time ASC ");

    // --- (执行查询) ---
    // (★ 修改: build_query_as::<ClassDetail>)
    let classes = match query_builder.build_query_as::<ClassDetail>().fetch_all(&state.db_pool).await {
        Ok(classes) => classes,
        Err(e) => {
            tracing::error!("Failed to fetch base classes (detail view): {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    Ok(Json(classes))
}

// (POST /api/v1/base/classes - "本基地" 创建一个新排课)
// (★ V2 - 此函数无修改 ★)
pub async fn create_base_class(
    State(state): State<AppState>,
    claims: Claims, 
    Json(payload): Json<CreateClassPayload>,
) -> Result<Json<Class>, StatusCode> {

    let tenant_id = claims.tenant_id;

    let base_id = match claims.base_id {
        Some(id) => id,
        None => {
            tracing::warn!("User {} without base_id tried to create a base-specific class", claims.sub);
            return Err(StatusCode::FORBIDDEN); 
        }
    };
    
    let new_class = match sqlx::query_as::<_, Class>(
        r#"
        INSERT INTO classes (
            tenant_id, base_id, course_id, teacher_id, room_id,
            start_time, end_time, max_capacity, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled')
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(base_id)
    .bind(payload.course_id)
    .bind(payload.teacher_id)
    .bind(payload.room_id)
    .bind(payload.start_time)
    .bind(payload.end_time)
    .bind(payload.max_capacity)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to create class: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    Ok(Json(new_class))
}