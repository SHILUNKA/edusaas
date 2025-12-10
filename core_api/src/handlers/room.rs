/*
 * src/handlers/room.rs
 * 职责: 教室 (Room) 管理
 * (★ V16.2 - Fix: 补充缺失的 Path, Uuid, UpdateRoomPayload 导入 ★)
 */

use axum::{
    extract::{State, Path}, // (★ 修复: 添加 Path)
    http::StatusCode, 
    Json
};
use uuid::Uuid; // (★ 修复: 添加 Uuid)

use super::AppState;
// (★ 修复: 添加 UpdateRoomPayload)
use crate::models::{Claims, Room, CreateRoomPayload, UpdateRoomPayload};

// (GET) 获取教室
pub async fn get_rooms_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<Room>>, StatusCode> {
    let tenant_id = claims.tenant_id;
    let is_hq = claims.roles.iter().any(|r| r == "role.tenant.admin");
    let is_base = claims.roles.iter().any(|r| r == "role.base.admin");

    if !is_hq && !is_base { return Err(StatusCode::FORBIDDEN); }

    let rooms = if is_hq {
        sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE tenant_id = $1 ORDER BY base_id, name ASC")
            .bind(tenant_id).fetch_all(&state.db_pool).await
    } else {
        let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;
        sqlx::query_as::<_, Room>("SELECT * FROM rooms WHERE tenant_id = $1 AND base_id = $2 ORDER BY name ASC")
            .bind(tenant_id).bind(base_id).fetch_all(&state.db_pool).await
    };

    match rooms {
        Ok(r) => Ok(Json(r)),
        Err(e) => {
            tracing::error!("Failed to fetch rooms: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// (POST) 创建教室
pub async fn create_room_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateRoomPayload>,
) -> Result<Json<Room>, StatusCode> {
    let is_hq = claims.roles.iter().any(|r| r == "role.tenant.admin");
    let is_base = claims.roles.iter().any(|r| r == "role.base.admin");
    if !is_hq && !is_base { return Err(StatusCode::FORBIDDEN); }

    let final_base_id = if is_hq { payload.base_id } else { claims.base_id.ok_or(StatusCode::FORBIDDEN)? };

    let new_room = sqlx::query_as::<_, Room>(
        r#"INSERT INTO rooms (tenant_id, base_id, name, capacity, layout_rows, layout_columns, is_schedulable) VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING *"#
    )
    .bind(claims.tenant_id).bind(final_base_id).bind(&payload.name).bind(payload.capacity)
    .bind(payload.layout_rows.unwrap_or(5)).bind(payload.layout_columns.unwrap_or(6))
    .fetch_one(&state.db_pool).await.map_err(|e| {
        tracing::error!("Failed to create room: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(new_room))
}

// (PUT) 更新教室
pub async fn update_room_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(room_id): Path<Uuid>,
    Json(payload): Json<UpdateRoomPayload>,
) -> Result<Json<Room>, StatusCode> {
    if claims.base_id.is_none() && !claims.roles.contains(&"role.tenant.admin".to_string()) {
        return Err(StatusCode::FORBIDDEN);
    }

    let updated = sqlx::query_as::<_, Room>(
        r#"UPDATE rooms SET name = $1, capacity = $2, layout_rows = $3, layout_columns = $4 WHERE id = $5 AND tenant_id = $6 RETURNING *"#
    )
    .bind(&payload.name).bind(payload.capacity).bind(payload.layout_rows).bind(payload.layout_columns)
    .bind(room_id).bind(claims.tenant_id)
    .fetch_one(&state.db_pool).await.map_err(|e| {
        tracing::error!("Failed to update room: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(updated))
}

// (DELETE) 删除教室
pub async fn delete_room_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(room_id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    if claims.base_id.is_none() && !claims.roles.contains(&"role.tenant.admin".to_string()) {
        return Err(StatusCode::FORBIDDEN);
    }

    let active_classes = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM classes WHERE room_id = $1 AND status = 'scheduled' AND start_time > NOW()"
    ).bind(room_id).fetch_one(&state.db_pool).await.unwrap_or(0);

    if active_classes > 0 { return Err(StatusCode::CONFLICT); }

    let res = sqlx::query("DELETE FROM rooms WHERE id = $1 AND tenant_id = $2")
        .bind(room_id).bind(claims.tenant_id).execute(&state.db_pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if res.rows_affected() == 0 { return Err(StatusCode::NOT_FOUND); }
    Ok(StatusCode::NO_CONTENT)
}