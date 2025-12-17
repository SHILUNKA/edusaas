/*
 * src/handlers/stock.rs
 * (★ V2.2 - 移除非法字符和重复定义 ★)
 */
use axum::{extract::State, http::StatusCode, Json};

use super::AppState;
use crate::models::{Claims, StockAlert}; 

// (GET /api/v1/base/stock/alerts)
pub async fn get_stock_alerts_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<StockAlert>>, StatusCode> {
    
    let hq_id = claims.hq_id;

    let base_id = match claims.base_id {
        Some(id) => id,
        None => {
            tracing::warn!("User {} without base_id tried to access stock", claims.sub);
            return Err(StatusCode::FORBIDDEN);
        }
    };

    let alerts = match sqlx::query_as::<_, StockAlert>(
        r#"
        SELECT 
            m.id as material_id,
            m.name_key,
            COALESCE(SUM(s.change_amount), 0) AS current_stock
        FROM 
            materials m
        LEFT JOIN 
            material_stock_changes s ON m.id = s.material_id AND s.base_id = $1
        WHERE 
            m.hq_id = $2
        GROUP BY 
            m.id, m.name_key
        HAVING 
            COALESCE(SUM(s.change_amount), 0) < 5
        "#,
    )
    .bind(base_id)
    .bind(hq_id)
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(alerts) => alerts,
        Err(e) => {
            tracing::error!("Failed to fetch stock alerts: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(alerts))
}

// (GET /api/v1/base/stock - 获取全量实时库存)
pub async fn get_base_stock_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<StockAlert>>, StatusCode> {

    let hq_id = claims.hq_id;

    let base_id = match claims.base_id {
        Some(id) => id,
        None => {
            tracing::warn!("User {} without base_id tried to access stock", claims.sub);
            return Err(StatusCode::FORBIDDEN);
        }
    };

    let stocks = match sqlx::query_as::<_, StockAlert>(
        r#"
        SELECT 
            m.id as material_id,
            m.name_key,
            COALESCE(SUM(s.change_amount), 0) AS current_stock
        FROM 
            materials m
        LEFT JOIN 
            material_stock_changes s ON m.id = s.material_id AND s.base_id = $1
        WHERE 
            m.hq_id = $2
        GROUP BY 
            m.id, m.name_key
        ORDER BY 
            current_stock DESC, m.name_key ASC;
        "#,
    )
    .bind(base_id)
    .bind(hq_id)
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(data) => data,
        Err(e) => {
            tracing::error!("Failed to fetch base stock: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(stocks))
}