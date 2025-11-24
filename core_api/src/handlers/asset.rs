/*
 * src/handlers/asset.rs
 * 职责: 资产类型 (AssetType) 管理
 * (★ V3 - 角色安全加固版 ★)
 */

use axum::{extract::State, http::StatusCode, Json};


// 【修改】导入 AppState 和 Claims
use super::AppState;
use super::auth::Claims; // <-- 我们需要“钥匙”
// 导入 models
use crate::models::{AssetType, CreateAssetTypePayload};


// (GET /api/v1/asset-types - 获取所有资产类型)
// (★ V2 - SaaS 安全加固 ★)
pub async fn get_asset_types(
    State(state): State<AppState>,
    claims: Claims, // <-- 【修改】必须出示“钥匙”
) -> Result<Json<Vec<AssetType>>, StatusCode> {
    
    // (HACK 已移除!)
    let tenant_id = claims.tenant_id; // <-- 【修改】使用“钥匙”中的租户ID

    let asset_types = match sqlx::query_as::<_, AssetType>(
        r#"
        SELECT id, tenant_id, name_key, description_key
        FROM asset_types
        WHERE tenant_id = $1
        ORDER BY name_key ASC
        "#,
    )
    .bind(tenant_id) // <-- 【修改】绑定“钥匙”中的ID
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(types) => types,
        Err(e) => {
            tracing::error!("Failed to fetch asset types: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(asset_types))
}

// (POST /api/v1/asset-types - 创建一个新资产类型)
// (★ V3 - 角色安全加固 ★)
pub async fn create_asset_type(
    State(state): State<AppState>,
    claims: Claims, // <-- 【修改】必须出示“钥匙”
    Json(payload): Json<CreateAssetTypePayload>,
) -> Result<Json<AssetType>, StatusCode> {
    
    // --- (★ 新增：角色安全守卫 ★) ---
    let is_authorized = claims.roles.iter().any(|role| 
        role == "role.tenant.admin"
    );

    if !is_authorized {
        tracing::warn!(
            "Unauthorized attempt to create asset type by user {} (roles: {:?})",
            claims.sub,
            claims.roles
        );
        return Err(StatusCode::FORBIDDEN); // 403 Forbidden
    }
    // --- (守卫结束) ---

    // (HACK 已移除!)
    let tenant_id = claims.tenant_id; // <-- 【修改】使用“钥匙”中的租户ID

    let new_asset_type = match sqlx::query_as::<_, AssetType>(
        r#"
        INSERT INTO asset_types (tenant_id, name_key, description_key)
        VALUES ($1, $2, $3)
        RETURNING *
        "#,
    )
    .bind(tenant_id) // <-- 【修改】绑定“钥匙”中的ID
    .bind(&payload.name_key)
    .bind(payload.description_key)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(asset_type) => asset_type,
        Err(e) => {
            tracing::error!("Failed to create asset type: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(new_asset_type))
}