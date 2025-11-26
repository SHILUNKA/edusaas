/*
 * src/handlers/class.rs
 * 职责: 排课 (Class) 管理
 * (★ V7.0 - 完整版: 含查询、创建、调课/代课 ★)
 */

use axum::{
    extract::{State, Query, Path}, 
    http::StatusCode, 
    Json
};
use serde::Deserialize; 
use sqlx::{QueryBuilder, FromRow};
use uuid::Uuid;
use chrono::{DateTime, Utc};

use super::AppState;
use super::auth::Claims; 
// 引入模型
use crate::models::{Class, CreateClassPayload, ClassDetail};

// --- DTO: 查询参数 ---
#[derive(Debug, Deserialize)]
pub struct GetClassesQuery {
    pub date: Option<String>, // "today", "2023-10-01", etc.
}

// --- DTO: 更新排课 (调课/代课) ---
// (因为只在 handler 内部使用，直接定义在这里即可)
#[derive(Debug, Deserialize)]
pub struct UpdateClassPayload {
    pub teacher_id: Option<Uuid>, // 换老师 (代课)
    pub room_id: Option<Uuid>,    // 换教室
    pub start_time: Option<DateTime<Utc>>, // 调时间
    pub end_time: Option<DateTime<Utc>>,
}

// (GET /api/v1/base/classes)
pub async fn get_base_classes_handler(
    State(state): State<AppState>,
    claims: Claims, 
    Query(query): Query<GetClassesQuery>, 
) -> Result<Json<Vec<ClassDetail>>, StatusCode> {

    let tenant_id = claims.tenant_id;

    // 1. 权限检查
    let base_id = match claims.base_id {
        Some(id) => id,
        None => {
            tracing::warn!("User {} without base_id tried to access classes", claims.sub);
            return Err(StatusCode::FORBIDDEN); 
        }
    };

    // 2. 动态构建查询
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

    // 日期过滤
    if let Some(date_filter) = query.date {
        if date_filter == "today" {
            // 使用数据库当前日期
            query_builder.push(" AND c.start_time::date = CURRENT_DATE ");
        } else {
            // (可选) 支持查询特定日期，例如 ?date=2025-11-25
            // 这里简单实现，如果需要更复杂的范围查询需解析字符串
        }
    }

    query_builder.push(" ORDER BY c.start_time ASC ");

    // 3. 执行查询
    let classes = match query_builder.build_query_as::<ClassDetail>().fetch_all(&state.db_pool).await {
        Ok(classes) => classes,
        Err(e) => {
            tracing::error!("Failed to fetch base classes: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    Ok(Json(classes))
}

// (POST /api/v1/base/classes)
pub async fn create_base_class_handler(
    State(state): State<AppState>,
    claims: Claims, 
    Json(payload): Json<CreateClassPayload>,
) -> Result<Json<Class>, StatusCode> {

    let tenant_id = claims.tenant_id;

    let base_id = match claims.base_id {
        Some(id) => id,
        None => return Err(StatusCode::FORBIDDEN), 
    };
    
    // (可选: 这里可以加冲突检测，防止同一老师同一时间两地分身)

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

// (PATCH /api/v1/base/classes/:id - 调课/代课)
// (需在 main.rs 中注册路由: .route("/api/v1/base/classes/:id", patch(update_class_handler)))
pub async fn update_class_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(class_id): Path<Uuid>,
    Json(payload): Json<UpdateClassPayload>,
) -> Result<StatusCode, StatusCode> {
    
    let tenant_id = claims.tenant_id;
    let base_id = match claims.base_id {
        Some(id) => id,
        None => return Err(StatusCode::FORBIDDEN),
    };

    // 动态构建 UPDATE 语句
    let mut query_builder: QueryBuilder<sqlx::Postgres> = QueryBuilder::new("UPDATE classes SET ");
    let mut separated = query_builder.separated(", ");

    if let Some(tid) = payload.teacher_id {
        separated.push("teacher_id = ");
        separated.push_bind_unseparated(tid);
    }
    if let Some(rid) = payload.room_id {
        separated.push("room_id = ");
        separated.push_bind_unseparated(rid);
    }
    if let Some(start) = payload.start_time {
        separated.push("start_time = ");
        separated.push_bind_unseparated(start);
    }
    if let Some(end) = payload.end_time {
        separated.push("end_time = ");
        separated.push_bind_unseparated(end);
    }

    // 如果没有任何字段要更新，直接返回
    if payload.teacher_id.is_none() && payload.room_id.is_none() 
       && payload.start_time.is_none() && payload.end_time.is_none() {
        return Ok(StatusCode::OK);
    }

    query_builder.push(" WHERE id = ");
    query_builder.push_bind(class_id);
    query_builder.push(" AND tenant_id = ");
    query_builder.push_bind(tenant_id);
    query_builder.push(" AND base_id = ");
    query_builder.push_bind(base_id);

    // 执行更新
    let result = query_builder.build().execute(&state.db_pool).await;

    match result {
        Ok(res) => {
            if res.rows_affected() == 0 {
                return Err(StatusCode::NOT_FOUND); // 没找到课，或无权修改
            }
            Ok(StatusCode::OK)
        },
        Err(e) => {
            tracing::error!("Failed to update class: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}