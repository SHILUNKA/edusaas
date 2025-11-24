/*
 * src/handlers/stock.rs
 * 职责: 基地库存 (Stock) 管理
 * (★ V1.0 - 看板低库存警报 ★)
 */

use axum::{extract::State, http::StatusCode, Json};

// 【新增】导入 AppState 和 Claims
use super::AppState;
use super::auth::Claims;
// 【新增】导入 models
use crate::models::StockAlert;


// --- 【新增 API】 ---

// (GET /api/v1/base/stock/alerts - 获取 "本基地" 低库存物料)
// (★ V2 - 基地安全加固 ★)
pub async fn get_stock_alerts_handler(
    State(state): State<AppState>,
    claims: Claims, // <-- 必须出示“钥匙”
) -> Result<Json<Vec<StockAlert>>, StatusCode> {

    let tenant_id = claims.tenant_id;

    // (★ SaaS 逻辑 ★)
    let base_id = match claims.base_id {
        Some(id) => id,
        None => {
            tracing::warn!("User {} without base_id tried to access base stock alerts", claims.sub);
            return Err(StatusCode::FORBIDDEN); // 403 Forbidden
        }
    };

    // --- (★ 核心逻辑: 聚合查询 ★) ---
    // (我们定义“低库存”为 < 5)
    let low_stock_threshold: i64 = 5;

    // 1. (★ 关键) 这是一个 "聚合查询 (GROUP BY)"
    // 2. (★ 关键) "HAVING" 子句用于筛选“聚合后” (SUM) 的结果
    let alerts = match sqlx::query_as::<_, StockAlert>(
        r#"
        SELECT 
            s.material_id,
            m.name_key,
            SUM(s.change_amount) AS current_stock
        FROM 
            material_stock_changes s
        JOIN 
            materials m ON s.material_id = m.id
        WHERE 
            s.base_id = $1 AND m.tenant_id = $2
        GROUP BY 
            s.material_id, m.name_key
        HAVING 
            SUM(s.change_amount) < $3
        ORDER BY 
            current_stock ASC;
        "#,
    )
    .bind(base_id)           // $1
    .bind(tenant_id)         // $2
    .bind(low_stock_threshold) // $3
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(alerts) => alerts, // (如果没有警报, Ok(alerts) 会是一个空列表 '[]')
        Err(e) => {
            tracing::error!("Failed to fetch base stock alerts: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(alerts))
}