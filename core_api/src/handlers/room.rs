/*
 * src/handlers/room.rs
 * 职责: 教室 (Room) 管理
 * (★ V2/V3 混合安全加固版 ★)
 */

use axum::{extract::State, http::StatusCode, Json};


// 【修改】导入 AppState 和 Claims
use super::AppState;
use super::auth::Claims; // <-- 我们需要“钥匙”
// 导入 models
use crate::models::{Room, CreateRoomPayload};


// (GET /api/v1/tenant/rooms - 获取 "本租户" 所有的教室, 按基地分组)
// (★ V2 - SaaS 安全加固 ★)
pub async fn get_all_tenant_rooms(
    State(state): State<AppState>,
    claims: Claims, // <-- 【修改】必须出示“钥匙”
) -> Result<Json<Vec<Room>>, StatusCode> {
    
    // (HACK 已移除!)
    let tenant_id = claims.tenant_id; // <-- 【修改】使用“钥匙”中的租户ID

    let rooms = match sqlx::query_as::<_, Room>(
        r#"
        SELECT * FROM rooms
        WHERE tenant_id = $1
        ORDER BY base_id, name ASC
        "#,
    )
    .bind(tenant_id) // <-- 【修改】绑定“钥匙”中的ID
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(rooms) => rooms,
        Err(e) => {
            tracing::error!("Failed to fetch all rooms: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    Ok(Json(rooms))
}

// (POST /api/v1/tenant/rooms - "总部" 创建一个新教室)
// (★ V3 - 角色安全加固 ★)
pub async fn create_room(
    State(state): State<AppState>,
    claims: Claims, // <-- 【修改】必须出示“钥匙”
    Json(payload): Json<CreateRoomPayload>,
) -> Result<Json<Room>, StatusCode> {
    
    // --- (★ 新增：角色安全守卫 ★) ---
    // (创建教室是总部权限)
    let is_authorized = claims.roles.iter().any(|role| 
        role == "role.tenant.admin"
    );

    if !is_authorized {
        tracing::warn!(
            "Unauthorized attempt to create room by user {} (roles: {:?})",
            claims.sub,
            claims.roles
        );
        return Err(StatusCode::FORBIDDEN); // 403 Forbidden
    }
    // --- (守卫结束) ---

    // (HACK 已移除!)
    let tenant_id = claims.tenant_id; // <-- 【修改】使用“钥匙”中的租户ID

    let new_room = match sqlx::query_as::<_, Room>(
        r#"
        INSERT INTO rooms (tenant_id, base_id, name, capacity, is_schedulable)
        VALUES ($1, $2, $3, $4, true)
        RETURNING *
        "#,
    )
    .bind(tenant_id) // <-- 【修改】绑定“钥匙”中的ID
    .bind(payload.base_id)
    .bind(&payload.name)
    .bind(payload.capacity)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(room) => room,
        Err(e) => {
            tracing::error!("Failed to create room: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    Ok(Json(new_room))
}

// (GET /api/v1/base/rooms - 获取 "本基地" 可用的教室列表)
// (★ V2 - 基地安全加固 ★)
pub async fn get_base_rooms(
    State(state): State<AppState>,
    claims: Claims, // <-- 【修改】必须出示“钥匙”
) -> Result<Json<Vec<Room>>, StatusCode> {

    let tenant_id = claims.tenant_id;

    // (★ SaaS 逻辑 ★)
    // 基地员工必须有关联的 base_id 才能调用这个 API
    let base_id = match claims.base_id {
        Some(id) => id,
        None => {
            tracing::warn!("User {} without base_id tried to access base-specific rooms", claims.sub);
            return Err(StatusCode::FORBIDDEN); // 403 Forbidden
        }
    };

    let rooms = match sqlx::query_as::<_, Room>(
        r#"
        SELECT * FROM rooms
        WHERE tenant_id = $1 AND base_id = $2 AND is_schedulable = true
        "#,
    )
    .bind(tenant_id) // <-- 【修改】绑定“钥匙”中的ID
    .bind(base_id)   // <-- 【修改】绑定“钥匙”中的 base_id
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(rooms) => rooms,
        Err(e) => {
            tracing::error!("Failed to fetch base rooms: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    Ok(Json(rooms))
}