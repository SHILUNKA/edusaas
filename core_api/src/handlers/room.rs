/*
 * src/handlers/room.rs
 * 职责: 教室 (Room) 管理
 * (★ V13.4 - 权限下放版 ★)
 */

use axum::{extract::State, http::StatusCode, Json};
use super::AppState;
use super::auth::Claims;
use crate::models::{Room, CreateRoomPayload};

// (GET) 获取教室 (通用接口)
// 逻辑: 总部看所有，基地看自己
pub async fn get_rooms_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<Room>>, StatusCode> {
    
    let tenant_id = claims.tenant_id;
    let is_hq = claims.roles.iter().any(|r| r == "role.tenant.admin");
    let is_base = claims.roles.iter().any(|r| r == "role.base.admin");

    if !is_hq && !is_base { return Err(StatusCode::FORBIDDEN); }

    let rooms = if is_hq {
        // 总部: 看所有，按基地分组
        sqlx::query_as::<_, Room>(
            "SELECT * FROM rooms WHERE tenant_id = $1 ORDER BY base_id, name ASC"
        )
        .bind(tenant_id)
        .fetch_all(&state.db_pool)
        .await
    } else {
        // 基地: 只看自己
        let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;
        sqlx::query_as::<_, Room>(
            "SELECT * FROM rooms WHERE tenant_id = $1 AND base_id = $2 ORDER BY name ASC"
        )
        .bind(tenant_id)
        .bind(base_id)
        .fetch_all(&state.db_pool)
        .await
    };

    match rooms {
        Ok(r) => Ok(Json(r)),
        Err(e) => {
            tracing::error!("Failed to fetch rooms: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// (POST) 创建教室 (权限下放)
pub async fn create_room_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateRoomPayload>,
) -> Result<Json<Room>, StatusCode> {
    
    let is_hq = claims.roles.iter().any(|r| r == "role.tenant.admin");
    let is_base = claims.roles.iter().any(|r| r == "role.base.admin");

    if !is_hq && !is_base { return Err(StatusCode::FORBIDDEN); }

    // 确定 base_id
    let final_base_id = if is_hq {
        // 总部: 必须指定基地ID
        payload.base_id 
    } else {
        // 基地: 强制使用当前用户的基地ID
        claims.base_id.ok_or(StatusCode::FORBIDDEN)?
    };

    let new_room = sqlx::query_as::<_, Room>(
        r#"
        INSERT INTO rooms (tenant_id, base_id, name, capacity, layout_rows, layout_columns, is_schedulable)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING *
        "#
    )
    .bind(claims.tenant_id)
    .bind(final_base_id)
    .bind(&payload.name)
    .bind(payload.capacity)
    .bind(payload.layout_rows.unwrap_or(5))
    .bind(payload.layout_columns.unwrap_or(6))
    .fetch_one(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create room: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(new_room))
}