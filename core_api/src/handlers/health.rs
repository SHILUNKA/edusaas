/*
 * src/handlers/health.rs
 * 职责: 健康检查
 */

use axum::{extract::State, http::StatusCode, Json};
use serde_json::Value;

use super::AppState;
use crate::models::Tenant;

pub async fn db_health_handler(
    State(state): State<AppState>,
) -> Result<Json<Tenant>, StatusCode> {
    match sqlx::query_as::<_, Tenant>("SELECT id, name FROM tenants LIMIT 1")
        .fetch_one(&state.db_pool)
        .await
    {
        Ok(tenant) => Ok(Json(tenant)),
        Err(e) => {
            tracing::error!("Database query failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn ai_health_handler(
    State(state): State<AppState>,
) -> Result<Json<Value>, StatusCode> {
    let url = format!("{}/health", state.ai_api_url);
    tracing::info!("Calling AI service at: {}", url);
    match state.http_client.get(&url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                let ai_response = response.json::<Value>().await.unwrap_or_default();
                Ok(Json(ai_response))
            } else {
                tracing::error!("AI service returned error: {}", response.status());
                Err(StatusCode::INTERNAL_SERVER_ERROR)
            }
        }
        Err(e) => {
            tracing::error!("Failed to call AI service: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}