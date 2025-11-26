/*
 * src/handlers/procurement.rs
 * (★ V5.2 - 修复所有权转移错误 ★)
 */
use axum::{
    extract::{State, Path},
    http::StatusCode,
    Json,
};
use uuid::Uuid;
use sqlx::Row;

use super::AppState;
use super::auth::Claims;
use crate::models::{
    ProcurementOrder, ProcurementItem, ProcurementStatus,
    CreateProcurementPayload, UpdateProcurementStatusPayload
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

    let mut tx = state.db_pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // (★ 修复: 克隆 submit_note，因为 String 不是 Copy 类型，不能被移动两次)
    let submit_note_clone = payload.submit_note.clone();

    // 2. 创建主订单
    let order_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO procurement_orders (tenant_id, base_id, applicant_id, status, submit_note)
        VALUES ($1, $2, $3, 'pending', $4)
        RETURNING id
        "#
    )
    .bind(tenant_id)
    .bind(base_id)
    .bind(Uuid::parse_str(&claims.sub).unwrap_or_default()) 
    .bind(submit_note_clone) // 使用克隆的值
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create order: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 3. 插入明细
    for item in payload.items {
        sqlx::query(
            "INSERT INTO procurement_items (order_id, material_id, quantity) VALUES ($1, $2, $3)"
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

    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 4. 返回
    Ok(Json(ProcurementOrder {
        id: order_id,
        tenant_id, base_id, 
        base_name: None, applicant_name: None,
        status: ProcurementStatus::Pending,
        submit_note: payload.submit_note, // 这里可以使用原值，因为上面的 bind 用的是 clone
        reject_reason: None,
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
        sqlx::query_as::<_, ProcurementOrder>(&format!("{} AND o.base_id = $2 ORDER BY o.created_at DESC", sql))
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
    _claims: Claims, // (★ 修复:以此表示有意忽略 claims 变量)
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
        "#
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

// (PUT) 更新状态
pub async fn update_procurement_status(
    State(state): State<AppState>,
    claims: Claims,
    Path(order_id): Path<Uuid>,
    Json(payload): Json<UpdateProcurementStatusPayload>,
) -> Result<StatusCode, StatusCode> {
    
    let mut tx = state.db_pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 1. 获取当前订单
    let order = sqlx::query("SELECT base_id, status FROM procurement_orders WHERE id = $1 FOR UPDATE")
        .bind(order_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let row = match order {
        Some(r) => r,
        None => return Err(StatusCode::NOT_FOUND),
    };
    
    let base_id: Uuid = row.get("base_id");

    // 2. 权限校验
    let is_hq = claims.base_id.is_none(); 
    
    match payload.status {
        ProcurementStatus::Approved | ProcurementStatus::Rejected | ProcurementStatus::Shipped => {
            if !is_hq { return Err(StatusCode::FORBIDDEN); } 
        },
        ProcurementStatus::Received => {
            if is_hq { return Err(StatusCode::FORBIDDEN); } 
        },
        _ => return Err(StatusCode::BAD_REQUEST),
    }

    // 3. 更新状态
    sqlx::query("UPDATE procurement_orders SET status = $1, reject_reason = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3")
        .bind(payload.status)
        .bind(payload.reject_reason)
        .bind(order_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Update status failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // 4. 如果是“确认收货”，自动增加库存
    if payload.status == ProcurementStatus::Received {
        let items = sqlx::query_as::<_, ProcurementItem>(
            r#"
            SELECT pi.id, pi.material_id, pi.quantity, '' as material_name, '' as unit 
            FROM procurement_items pi WHERE pi.order_id = $1
            "#
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
                "#
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

    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::OK)
}