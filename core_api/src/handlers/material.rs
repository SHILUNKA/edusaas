/*
 * src/handlers/material.rs
 * 职责: 物料 (Materials) 管理
 * (★ V3 - 角色安全加固版 ★)
 */

use axum::{extract::State, http::StatusCode, Json};


// 【修改】导入 AppState 和 Claims
use super::AppState;
// 导入 models
use crate::models::{Claims, Material, CreateMaterialPayload};


// (GET /api/v1/materials - 获取所有物料定义)
// (★ V2 - SaaS 安全加固 ★)
pub async fn get_materials_handler(
    State(state): State<AppState>,
    claims: Claims, // <-- 【修改】必须出示“钥匙”
) -> Result<Json<Vec<Material>>, StatusCode> {
    
    // (HACK 已移除!)
    let hq_id = claims.hq_id; // <-- 【修改】使用“钥匙”中的租户ID

    let materials = match sqlx::query_as::<_, Material>(
        r#"
        SELECT id, hq_id, name_key, description_key, sku, unit_of_measure
        FROM materials
        WHERE hq_id = $1
        ORDER BY name_key ASC
        "#,
    )
    .bind(hq_id) // <-- 【修改】绑定“钥匙”中的ID
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(materials) => materials,
        Err(e) => {
            tracing::error!("Failed to fetch materials: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(materials))
}

// (POST /api/v1/materials - 创建一个新物料定义)
// (★ V3 - 角色安全加固 ★)
pub async fn create_material_handler(
    State(state): State<AppState>,
    claims: Claims, // <-- 【修改】必须出示“钥匙”
    Json(payload): Json<CreateMaterialPayload>,
) -> Result<Json<Material>, StatusCode> {
    
    // --- (★ 新增：角色安全守卫 ★) ---
    // 检查“钥匙”中的角色列表是否包含“租户管理员”
    let is_authorized = claims.roles.iter().any(|role| 
        role == "role.hq.admin"
    );

    if !is_authorized {
        tracing::warn!(
            "Unauthorized attempt to create material by user {} (roles: {:?})",
            claims.sub,
            claims.roles
        );
        // 403 Forbidden: "我认识你(Token有效)，但你没有权限(Role不对)"
        return Err(StatusCode::FORBIDDEN);
    }
    // --- (守卫结束) ---

    // (HACK 已移除!)
    let hq_id = claims.hq_id; // <-- 【修改】使用“钥匙”中的租户ID

    let new_material = match sqlx::query_as::<_, Material>(
        r#"
        INSERT INTO materials (hq_id, name_key, description_key, sku, unit_of_measure)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        "#,
    )
    .bind(hq_id) // <-- 【修改】绑定“钥匙”中的ID
    .bind(&payload.name_key)
    .bind(payload.description_key)
    .bind(payload.sku)
    .bind(payload.unit_of_measure)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(material) => material,
        Err(e) => {
            tracing::error!("Failed to create material: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(new_material))
}