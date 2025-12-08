/*
 * src/handlers/procurement.rs
 * (★ V5.3 - 修复: 初始化缺失字段 ★)
 */
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use sqlx::Row;
use uuid::Uuid;

use super::auth::Claims;
use super::AppState;
use crate::models::{
    CreateProcurementPayload, ProcurementItem, ProcurementOrder, ProcurementStatus,
    UpdateProcurementStatusPayload,
};

// (POST) 提交采购申请
pub async fn create_procurement_order(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateProcurementPayload>,
) -> Result<Json<ProcurementOrder>, StatusCode> {
    let tenant_id = claims.tenant_id;

    // 1. 必须是基地用户
    let base_id = match claims.base_id {
        Some(id) => id,
        None => return Err(StatusCode::FORBIDDEN),
    };

    let mut tx = state
        .db_pool
        .begin()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let submit_note_clone = payload.submit_note.clone();

    // 2. 创建主订单
    let order_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO procurement_orders (tenant_id, base_id, applicant_id, status, submit_note)
        VALUES ($1, $2, $3, 'pending', $4)
        RETURNING id
        "#,
    )
    .bind(tenant_id)
    .bind(base_id)
    .bind(Uuid::parse_str(&claims.sub).unwrap_or_default())
    .bind(submit_note_clone)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create order: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 3. 插入明细
    for item in payload.items {
        sqlx::query(
            "INSERT INTO procurement_items (order_id, material_id, quantity) VALUES ($1, $2, $3)",
        )
        .bind(order_id)
        .bind(item.material_id)
        .bind(item.quantity)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Failed to insert item: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    }

    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 4. 返回
    Ok(Json(ProcurementOrder {
        id: order_id,
        tenant_id,
        base_id,
        base_name: None,
        applicant_name: None,
        status: ProcurementStatus::Pending,
        submit_note: payload.submit_note,
        reject_reason: None,
        // (★ 修复: 初始化新字段)
        logistics_company: None,
        tracking_number: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    }))
}

// (GET) 获取采购单列表
pub async fn get_procurement_orders(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<ProcurementOrder>>, StatusCode> {
    let tenant_id = claims.tenant_id;

    let sql = r#"
        SELECT 
            o.*, 
            b.name as base_name,
            u.full_name as applicant_name
        FROM procurement_orders o
        LEFT JOIN bases b ON o.base_id = b.id
        LEFT JOIN users u ON o.applicant_id = u.id
        WHERE o.tenant_id = $1
    "#;

    let orders = if let Some(base_id) = claims.base_id {
        sqlx::query_as::<_, ProcurementOrder>(&format!(
            "{} AND o.base_id = $2 ORDER BY o.created_at DESC",
            sql
        ))
        .bind(tenant_id)
        .bind(base_id)
        .fetch_all(&state.db_pool)
        .await
    } else {
        sqlx::query_as::<_, ProcurementOrder>(&format!("{} ORDER BY o.created_at DESC", sql))
            .bind(tenant_id)
            .fetch_all(&state.db_pool)
            .await
    };

    orders.map(Json).map_err(|e| {
        tracing::error!("Fetch orders failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })
}

// (GET) 获取单条订单详情
pub async fn get_procurement_details(
    State(state): State<AppState>,
    _claims: Claims,
    Path(order_id): Path<Uuid>,
) -> Result<Json<Vec<ProcurementItem>>, StatusCode> {
    let items = sqlx::query_as::<_, ProcurementItem>(
        r#"
        SELECT 
            pi.id, pi.material_id, pi.quantity,
            m.name_key as material_name,
            m.unit_of_measure as unit
        FROM procurement_items pi
        JOIN materials m ON pi.material_id = m.id
        WHERE pi.order_id = $1
        "#,
    )
    .bind(order_id)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Fetch items failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(items))
}

// (PUT) 更新状态 (含发货)
pub async fn update_procurement_status(
    State(state): State<AppState>,
    claims: Claims,
    Path(order_id): Path<Uuid>,
    Json(payload): Json<UpdateProcurementStatusPayload>,
) -> Result<StatusCode, StatusCode> {
    let mut tx = state
        .db_pool
        .begin()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let order =
        sqlx::query("SELECT base_id, status FROM procurement_orders WHERE id = $1 FOR UPDATE")
            .bind(order_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let row = match order {
        Some(r) => r,
        None => return Err(StatusCode::NOT_FOUND),
    };

    let base_id: Uuid = row.get("base_id");
    let is_hq = claims.base_id.is_none();

    match payload.status {
        ProcurementStatus::Approved | ProcurementStatus::Rejected | ProcurementStatus::Shipped => {
            if !is_hq {
                return Err(StatusCode::FORBIDDEN);
            }
        }
        ProcurementStatus::Received => {
            if is_hq {
                return Err(StatusCode::FORBIDDEN);
            }
        }
        _ => return Err(StatusCode::BAD_REQUEST),
    }

    sqlx::query(
        r#"
        UPDATE procurement_orders 
        SET status = $1, reject_reason = $2, 
            logistics_company = $3, tracking_number = $4,
            updated_at = NOW() 
        WHERE id = $5
        "#,
    )
    .bind(payload.status)
    .bind(payload.reject_reason)
    .bind(payload.logistics_company)
    .bind(payload.tracking_number)
    .bind(order_id)
    .execute(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if payload.status == ProcurementStatus::Received {
        let items = sqlx::query_as::<_, ProcurementItem>(
            r#"
            SELECT pi.id, pi.material_id, pi.quantity, '' as material_name, '' as unit 
            FROM procurement_items pi WHERE pi.order_id = $1
            "#,
        )
        .bind(order_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        for item in items {
            sqlx::query(
                r#"
                INSERT INTO material_stock_changes (material_id, base_id, change_amount, reason_key)
                VALUES ($1, $2, $3, 'stock.reason.procurement_in')
                "#,
            )
            .bind(item.material_id)
            .bind(base_id)
            .bind(item.quantity)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                tracing::error!("Stock update failed: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
        }
    }

    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::OK)
}
