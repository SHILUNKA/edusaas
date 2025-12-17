/*
 * src/handlers/customer.rs
 * 职责: 客户/家长 (Customer) 管理 (SaaS 强化)
 */

use axum::{
    extract::State,
    http::StatusCode,
    Json,
};

// 导入在 mod.rs 中定义的 AppState
use super::AppState;
// 导入 models
use crate::models::{Claims, Customer, CreateCustomerPayload};

// (POST /api/v1/customers - B端创建家长)
pub async fn create_customer_handler(
    State(state): State<AppState>,
    claims: Claims, // <-- 自动验证 Token, 获取 Claims
    Json(payload): Json<CreateCustomerPayload>,
) -> Result<Json<Customer>, StatusCode> {
    
    let hq_id = claims.hq_id;

    let base_id = match claims.base_id {
        Some(id) => id,
        None => {
            tracing::warn!("User {} without base_id tried to create customer", claims.sub);
            return Err(StatusCode::FORBIDDEN); // 403 Forbidden
        }
    };

    let new_customer = match sqlx::query_as::<_, Customer>(
        r#"
        INSERT INTO customers (hq_id, base_id, name, phone_number)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(hq_id)
    .bind(base_id)
    .bind(payload.name)
    .bind(&payload.phone_number)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(customer) => customer,
        Err(e) => {
            if let Some(db_err) = e.as_database_error() {
                if db_err.is_unique_violation() {
                    tracing::warn!("Failed to create customer, phone number already exists: {}", payload.phone_number);
                    return Err(StatusCode::CONFLICT); // 409 Conflict
                }
            }
            tracing::error!("Failed to create customer: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(new_customer))
}

// (GET /api/v1/customers - 获取客户列表)
pub async fn get_customers_handler(
    State(state): State<AppState>,
    claims: Claims, // <-- 自动验证 Token, 获取 Claims
) -> Result<Json<Vec<Customer>>, StatusCode> {
    
    let customers: Vec<Customer>;

    if let Some(base_id) = claims.base_id {
        // --- 场景 A: 基地员工 ---
        tracing::debug!("Fetching customers for base_id: {}", base_id);
        customers = sqlx::query_as::<_, Customer>(
            r#"
            SELECT * FROM customers
            WHERE hq_id = $1 AND base_id = $2
            ORDER BY created_at DESC
            "#,
        )
        .bind(claims.hq_id)
        .bind(base_id)
        .fetch_all(&state.db_pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch base customers: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
        
    } else {
        // --- 场景 B: 租户管理员 (无 base_id) ---
        tracing::debug!("Fetching all customers for hq_id: {}", claims.hq_id);
        customers = sqlx::query_as::<_, Customer>(
            r#"
            SELECT * FROM customers
            WHERE hq_id = $1
            ORDER BY base_id, created_at DESC
            "#,
        )
        .bind(claims.hq_id)
        .fetch_all(&state.db_pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch all hq customers: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    }

    Ok(Json(customers))
}