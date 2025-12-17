/*
 * src/handlers/asset.rs
 * 职责: 固定资产 (Fixed Assets) 全生命周期管理
 * (★ V16.7 - 优雅枚举版 ★)
 */

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;

use super::AppState;
// (★ 引入 AssetStatus)
use crate::models::{
    Asset, AssetDetail, AssetQuery, AssetStatus, AssetType, Claims, CreateAssetPayload, CreateAssetTypePayload, TransferAssetPayload,
};

// (GET) 总部查看全网资产台账
pub async fn get_all_assets_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(params): Query<AssetQuery>,
) -> Result<Json<Vec<AssetDetail>>, StatusCode> {
    if !claims.roles.contains(&"role.hq.admin".to_string()) {
        return Err(StatusCode::FORBIDDEN);
    }

    let mut query = String::from(
        r#"
        SELECT 
            a.id, a.name, a.model_number, a.serial_number, 
            a.status, -- (★ 不需要 ::text 了)
            a.purchase_date, a.warranty_until, a.price_in_cents,
            t.name_key as type_name,
            b.id as base_id, b.name as base_name
        FROM assets a
        LEFT JOIN asset_types t ON a.asset_type_id = t.id
        LEFT JOIN bases b ON a.base_id = b.id
        WHERE a.hq_id = $1
        "#,
    );

    if let Some(bid) = params.base_id {
        query.push_str(&format!(" AND a.base_id = '{}'", bid));
    }
    if let Some(s) = params.status {
        // 注意：status 是枚举，查询时可能需要单引号
        // 但为了安全，最好用 bind，这里动态 SQL 拼接简单处理
        query.push_str(&format!(" AND a.status = '{}'", s));
    }
    if let Some(k) = params.keyword {
        if !k.is_empty() {
            let safe_k = k.replace("'", "");
            query.push_str(&format!(
                " AND (a.name ILIKE '%{}%' OR a.serial_number ILIKE '%{}%')",
                safe_k, safe_k
            ));
        }
    }

    query.push_str(" ORDER BY a.created_at DESC LIMIT 500");

    let assets = sqlx::query_as::<_, AssetDetail>(&query)
        .bind(claims.hq_id)
        .fetch_all(&state.db_pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch assets: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(assets))
}

// (POST) 录入新实物资产
pub async fn create_asset_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateAssetPayload>,
) -> Result<Json<Asset>, StatusCode> {
    if !claims.roles.contains(&"role.hq.admin".to_string()) {
        return Err(StatusCode::FORBIDDEN);
    }

    let price_cents = (payload.price.unwrap_or(0.0) * 100.0) as i32;
    // (★ 使用枚举默认值)
    let status = payload.status.unwrap_or(AssetStatus::InStock);

    let new_asset = sqlx::query_as::<_, Asset>(
        r#"
        INSERT INTO assets (
            hq_id, base_id, asset_type_id, name, model_number, 
            serial_number, status, purchase_date, warranty_until, price_in_cents
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        "#,
    )
    .bind(claims.hq_id)
    .bind(payload.base_id)
    .bind(payload.asset_type_id)
    .bind(&payload.name)
    .bind(payload.model_number)
    .bind(payload.serial_number)
    .bind(status) // (★ sqlx 会自动处理枚举绑定)
    .bind(payload.purchase_date)
    .bind(payload.warranty_until)
    .bind(price_cents)
    .fetch_one(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create asset: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(new_asset))
}

// (PATCH) 资产调拨
pub async fn transfer_asset_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<Uuid>,
    Json(payload): Json<TransferAssetPayload>,
) -> Result<StatusCode, StatusCode> {
    if !claims.roles.contains(&"role.hq.admin".to_string()) {
        return Err(StatusCode::FORBIDDEN);
    }

    let result = sqlx::query(
        "UPDATE assets SET base_id = $1, updated_at = NOW() WHERE id = $2 AND hq_id = $3",
    )
    .bind(payload.target_base_id)
    .bind(id)
    .bind(claims.hq_id)
    .execute(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to transfer asset: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }
    Ok(StatusCode::OK)
}

// (DELETE) 资产报废
pub async fn delete_asset_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    if !claims.roles.contains(&"role.hq.admin".to_string()) {
        return Err(StatusCode::FORBIDDEN);
    }

    let res = sqlx::query("DELETE FROM assets WHERE id = $1 AND hq_id = $2")
        .bind(id)
        .bind(claims.hq_id)
        .execute(&state.db_pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if res.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }
    Ok(StatusCode::NO_CONTENT)
}

// (GET /api/v1/asset-types - 获取所有资产类型)
// (★ V2 - SaaS 安全加固 ★)
pub async fn get_asset_types_handler(
    State(state): State<AppState>,
    claims: Claims, // <-- 【修改】必须出示“钥匙”
) -> Result<Json<Vec<AssetType>>, StatusCode> {
    
    // (HACK 已移除!)
    let hq_id = claims.hq_id; // <-- 【修改】使用“钥匙”中的租户ID

    let asset_types = match sqlx::query_as::<_, AssetType>(
        r#"
        SELECT id, hq_id, name_key, description_key
        FROM asset_types
        WHERE hq_id = $1
        ORDER BY name_key ASC
        "#,
    )
    .bind(hq_id) // <-- 【修改】绑定“钥匙”中的ID
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
pub async fn create_asset_type_handler(
    State(state): State<AppState>,
    claims: Claims, // <-- 【修改】必须出示“钥匙”
    Json(payload): Json<CreateAssetTypePayload>,
) -> Result<Json<AssetType>, StatusCode> {
    
    // --- (★ 新增：角色安全守卫 ★) ---
    let is_authorized = claims.roles.iter().any(|role| 
        role == "role.hq.admin"
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
    let hq_id = claims.hq_id; // <-- 【修改】使用“钥匙”中的租户ID

    let new_asset_type = match sqlx::query_as::<_, AssetType>(
        r#"
        INSERT INTO asset_types (hq_id, name_key, description_key)
        VALUES ($1, $2, $3)
        RETURNING *
        "#,
    )
    .bind(hq_id) // <-- 【修改】绑定“钥匙”中的ID
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
