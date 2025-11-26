/*
 * src/handlers/class.rs
 * 职责: 排课 (Class) 管理
 * (★ V12.1 - 修复 room_rows 缺失错误 ★)
 */

use axum::{
    extract::{State, Query, Path}, 
    http::StatusCode, 
    Json
};
use serde::Deserialize; 
use sqlx::{QueryBuilder, FromRow};
use uuid::Uuid;
use chrono::{DateTime, Utc, Duration};

use super::AppState;
use super::auth::Claims; 
use crate::models::{Class, CreateClassPayload, ClassDetail};

// --- DTO: 查询参数 ---
#[derive(Debug, Deserialize)]
pub struct GetClassesQuery {
    pub date: Option<String>, 
}

// --- DTO: 更新排课 ---
#[derive(Debug, Deserialize)]
pub struct UpdateClassPayload {
    pub teacher_ids: Option<Vec<Uuid>>,
    pub room_id: Option<Uuid>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
}

// (GET /api/v1/base/classes)
pub async fn get_base_classes_handler(
    State(state): State<AppState>,
    claims: Claims, 
    Query(query): Query<GetClassesQuery>, 
) -> Result<Json<Vec<ClassDetail>>, StatusCode> {

    let tenant_id = claims.tenant_id;

    let base_id = match claims.base_id {
        Some(id) => id,
        None => {
            tracing::warn!("User {} without base_id tried to access classes", claims.sub);
            return Err(StatusCode::FORBIDDEN); 
        }
    };

    // (★ 关键修复: SQL 必须包含 room_rows 和 room_columns)
    let mut query_builder: QueryBuilder<sqlx::Postgres> = QueryBuilder::new(
        r#"
        SELECT 
            c.id, c.tenant_id, c.base_id, c.course_id, c.room_id, c.start_time, c.end_time, c.max_capacity, c.status,
            co.name_key AS course_name_key,
            r.name AS room_name,
            -- (★ 修复点 1: 添加这两个字段)
            r.layout_rows AS room_rows,
            r.layout_columns AS room_columns,
            -- (多老师聚合)
            STRING_AGG(DISTINCT u.full_name, ', ') AS teacher_names
        FROM 
            classes c
        LEFT JOIN courses co ON c.course_id = co.id
        LEFT JOIN rooms r ON c.room_id = r.id
        LEFT JOIN class_teachers ct ON c.id = ct.class_id
        LEFT JOIN teachers t ON ct.teacher_id = t.user_id
        LEFT JOIN users u ON t.user_id = u.id
        WHERE 
            c.tenant_id = 
        "#
    );

    query_builder.push_bind(tenant_id);
    query_builder.push(" AND c.base_id = ");
    query_builder.push_bind(base_id);

    if let Some(date_filter) = query.date {
        if date_filter == "today" {
            query_builder.push(" AND c.start_time::date = CURRENT_DATE ");
        }
    }
    
    // (★ 修复点 2: GROUP BY 也要加上这两个字段)
    query_builder.push(" GROUP BY c.id, co.name_key, r.name, r.layout_rows, r.layout_columns ORDER BY c.start_time ASC ");

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
) -> Result<Json<Vec<Class>>, StatusCode> {

    let tenant_id = claims.tenant_id;
    let base_id = match claims.base_id {
        Some(id) => id,
        None => return Err(StatusCode::FORBIDDEN), 
    };

    let recurrence = payload.recurrence_type.as_deref().unwrap_or("none");
    let count = if recurrence == "none" { 1 } else { payload.repeat_count.unwrap_or(1) };
    
    if count > 50 { return Err(StatusCode::BAD_REQUEST); }

    let mut created_classes = Vec::new();
    let mut tx = state.db_pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    for i in 0..count {
        let days_to_add = match recurrence {
            "weekly" => i * 7,
            "biweekly" => i * 14,
            _ => 0,
        };
        
        let current_start = payload.start_time + Duration::days(days_to_add as i64);
        let current_end = payload.end_time + Duration::days(days_to_add as i64);

        let new_class = sqlx::query_as::<_, Class>(
            r#"
            INSERT INTO classes (
                tenant_id, base_id, course_id, room_id,
                start_time, end_time, max_capacity, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled')
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(base_id)
        .bind(payload.course_id)
        .bind(payload.room_id)
        .bind(current_start)
        .bind(current_end)
        .bind(payload.max_capacity)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create class: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        for teacher_id in &payload.teacher_ids {
             sqlx::query("INSERT INTO class_teachers (class_id, teacher_id) VALUES ($1, $2)")
                .bind(new_class.id)
                .bind(teacher_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to link teacher: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;
        }

        created_classes.push(new_class);
    }

    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(created_classes))
}

// (PATCH /api/v1/base/classes/:id)
pub async fn update_class_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(class_id): Path<Uuid>,
    Json(payload): Json<UpdateClassPayload>,
) -> Result<StatusCode, StatusCode> {
    
    let tenant_id = claims.tenant_id;
    let base_id = match claims.base_id { Some(id) => id, None => return Err(StatusCode::FORBIDDEN) };

    let mut tx = state.db_pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if payload.room_id.is_some() || payload.start_time.is_some() || payload.end_time.is_some() {
        let mut query_builder: QueryBuilder<sqlx::Postgres> = QueryBuilder::new("UPDATE classes SET ");
        let mut separated = query_builder.separated(", ");

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

        query_builder.push(" WHERE id = ");
        query_builder.push_bind(class_id);
        query_builder.push(" AND tenant_id = ");
        query_builder.push_bind(tenant_id);
        query_builder.push(" AND base_id = ");
        query_builder.push_bind(base_id);
        
        query_builder.build().execute(&mut *tx).await.map_err(|e| {
            tracing::error!("Failed to update class info: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    }

    if let Some(teacher_ids) = payload.teacher_ids {
        sqlx::query("DELETE FROM class_teachers WHERE class_id = $1")
            .bind(class_id)
            .execute(&mut *tx)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            
        for tid in teacher_ids {
            sqlx::query("INSERT INTO class_teachers (class_id, teacher_id) VALUES ($1, $2)")
                .bind(class_id)
                .bind(tid)
                .execute(&mut *tx)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        }
    }
    
    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::OK)
}

// (DELETE /api/v1/base/classes/:id)
pub async fn delete_class_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(class_id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let tenant_id = claims.tenant_id;
    let base_id = match claims.base_id { Some(id) => id, None => return Err(StatusCode::FORBIDDEN) };

    let result = sqlx::query(
        "DELETE FROM classes WHERE id = $1 AND tenant_id = $2 AND base_id = $3"
    )
    .bind(class_id)
    .bind(tenant_id)
    .bind(base_id)
    .execute(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to delete class: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}