/*
 * src/handlers/base.rs
 * V24.3 - 终极修复版: 
 * 1. 修复学员统计报错 (Join customers)
 * 2. 集成营收拆分 (ToB / ToC)
 */
use axum::{
    extract::{State, Path}, 
    http::StatusCode, 
    Json
};
use uuid::Uuid;
use super::AppState;
use crate::models::{Base, Claims, CreateBasePayload, UpdateBasePayload}; 

// GET /api/v1/bases - 获取基地列表
pub async fn get_hq_bases_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<Base>>, StatusCode> {
    
    // ★★★ 修复后的 SQL ★★★
    let bases = match sqlx::query_as::<_, Base>(
        r#"
        SELECT 
            b.id, b.hq_id, b.name, b.address, b.code,
            b.logo_url, b.status, b.operation_mode,
            b.auth_start_date, b.auth_end_date,
            
            -- 1. 学员总数 (修复: 关联 customers 表查询 base_id)
            (
                SELECT COUNT(p.id) 
                FROM participants p
                JOIN customers c ON p.customer_id = c.id
                WHERE c.base_id = b.id
            ) as student_count,

            -- 2. 零售/办卡营收 (To C) - 本月
            COALESCE((
                SELECT SUM(o.paid_amount_cents) 
                FROM orders o 
                WHERE o.base_id = b.id 
                  AND o.created_at >= date_trunc('month', CURRENT_DATE)
                  AND o.type = 'b2c'
            ), 0)::float8 as revenue_toc,

            -- 3. 团单/政企营收 (To B) - 本月
            COALESCE((
                SELECT SUM(o.paid_amount_cents) 
                FROM orders o 
                WHERE o.base_id = b.id 
                  AND o.created_at >= date_trunc('month', CURRENT_DATE)
                  AND o.type IN ('b2b', 'b2g')
            ), 0)::float8 as revenue_tob

        FROM bases b
        WHERE b.hq_id = $1
        ORDER BY b.created_at DESC
        "#,
    )
    .bind(claims.hq_id)
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(bases) => bases,
        Err(e) => {
            tracing::error!("Failed to fetch bases stats: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(bases))
}

// POST /api/v1/bases - 创建
pub async fn create_hq_base_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateBasePayload>,
) -> Result<Json<Base>, StatusCode> {
    let is_authorized = claims.roles.iter().any(|role| role == "role.hq.admin");
    if !is_authorized { return Err(StatusCode::FORBIDDEN); }

    let code = payload.code.trim().to_uppercase();
    if code.len() < 2 || code.len() > 5 { return Err(StatusCode::BAD_REQUEST); }

    let new_base = sqlx::query_as::<_, Base>(
        r#"
        INSERT INTO bases (hq_id, name, address, code, auth_start_date, auth_end_date) 
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING 
            id, hq_id, name, code, address, logo_url, status, operation_mode,
            auth_start_date, auth_end_date,
            0::bigint as student_count, 
            0::float8 as revenue_toc, 
            0::float8 as revenue_tob
        "#
    )
    .bind(claims.hq_id)
    .bind(&payload.name)
    .bind(&payload.address)
    .bind(&code)
    .bind(payload.auth_start_date)
    .bind(payload.auth_end_date)
    .fetch_one(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create base: {}", e);
        StatusCode::CONFLICT 
    })?;

    Ok(Json(new_base))
}

// PUT /api/v1/bases/:id - 更新
pub async fn update_hq_base_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(base_id): Path<Uuid>,
    Json(payload): Json<UpdateBasePayload>,
) -> Result<Json<Base>, StatusCode> {
    let is_authorized = claims.roles.iter().any(|role| role == "role.hq.admin");
    if !is_authorized { return Err(StatusCode::FORBIDDEN); }

    let code = payload.code.trim().to_uppercase();
    if code.len() < 2 || code.len() > 5 { return Err(StatusCode::BAD_REQUEST); }

    let updated_base = sqlx::query_as::<_, Base>(
        r#"
        UPDATE bases 
        SET name = $1, address = $2, code = $3, logo_url = $4, status = $5, operation_mode = $6,
            auth_start_date = $7, auth_end_date = $8
        WHERE id = $9 AND hq_id = $10
        RETURNING 
            id, hq_id, name, code, address, logo_url, status, operation_mode,
            auth_start_date, auth_end_date,
            -- 更新时重新计算统计
            (
                SELECT COUNT(p.id) 
                FROM participants p
                JOIN customers c ON p.customer_id = c.id
                WHERE c.base_id = bases.id
            ) as student_count,
            COALESCE((
                SELECT SUM(paid_amount_cents) FROM orders WHERE base_id = bases.id AND created_at >= date_trunc('month', CURRENT_DATE) AND type = 'b2c'
            ), 0)::float8 as revenue_toc,
            COALESCE((
                SELECT SUM(paid_amount_cents) FROM orders WHERE base_id = bases.id AND created_at >= date_trunc('month', CURRENT_DATE) AND type IN ('b2b', 'b2g')
            ), 0)::float8 as revenue_tob
        "#
    )
    .bind(&payload.name)
    .bind(&payload.address)
    .bind(&code)
    .bind(&payload.logo_url)
    .bind(&payload.status)
    .bind(&payload.operation_mode)
    .bind(payload.auth_start_date)
    .bind(payload.auth_end_date)
    .bind(base_id)
    .bind(claims.hq_id)
    .fetch_one(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update base: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(updated_base))
}