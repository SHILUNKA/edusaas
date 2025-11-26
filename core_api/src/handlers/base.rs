/*
 * src/handlers/base.rs
 * 职责: 基地 (Bases) 管理
 * (★ V3 - 角色安全加固版 ★)
 */

use axum::{extract::State, http::StatusCode, Json};


// 【修改】导入 AppState 和 Claims
use super::AppState;
use super::auth::Claims; // <-- 我们需要“钥匙”
// 导入 models
use crate::models::{Base, CreateBasePayload};


// (GET /api/v1/bases - 获取所有基地列表)
// (★ V2 - SaaS 安全加固 ★)
pub async fn get_tenant_bases_handler(
    State(state): State<AppState>,
    claims: Claims, // <-- 【修改】必须出示“钥匙”
) -> Result<Json<Vec<Base>>, StatusCode> {
    
    // (HACK 已移除!)
    let tenant_id = claims.tenant_id; // <-- 【修改】使用“钥匙”中的租户ID

    let bases = match sqlx::query_as::<_, Base>(
        r#"
        SELECT id, tenant_id, name, address FROM bases
        WHERE tenant_id = $1
        ORDER BY name ASC
        "#,
    )
    .bind(tenant_id) // <-- 【修改】绑定“钥匙”中的ID
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(bases) => bases,
        Err(e) => {
            tracing::error!("Failed to fetch bases: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(bases))
}

// (POST /api/v1/bases - 创建一个新基地)
// (★ V3 - 角色安全加固 ★)
pub async fn create_tenant_base_handler(
    State(state): State<AppState>,
    claims: Claims, // <-- 【修改】必须出示“钥匙”
    Json(payload): Json<CreateBasePayload>,
) -> Result<Json<Base>, StatusCode> {
    
    // --- (★ 新增：角色安全守卫 ★) ---
    // 检查“钥匙”中的角色列表是否包含“租户管理员”
    let is_authorized = claims.roles.iter().any(|role| 
        role == "role.tenant.admin"
    );

    if !is_authorized {
        tracing::warn!(
            "Unauthorized attempt to create base by user {} (roles: {:?})",
            claims.sub,
            claims.roles
        );
        // 403 Forbidden: "我认识你(Token有效)，但你没有权限(Role不对)"
        return Err(StatusCode::FORBIDDEN);
    }
    // --- (守卫结束) ---
    
    // (HACK 已移除!)
    let tenant_id = claims.tenant_id; // <-- 【修改】使用“钥匙”中的租户ID

    let new_base = match sqlx::query_as::<_, Base>(
        r#"
        INSERT INTO bases (tenant_id, name, address)
        VALUES ($1, $2, $3)
        RETURNING *
        "#,
    )
    .bind(tenant_id) // <-- 【修改】绑定“钥匙”中的ID
    .bind(&payload.name)
    .bind(payload.address)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(base) => base,
        Err(e) => {
            tracing::error!("Failed to create base: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(new_base))
}