/*
 * src/handlers/supply.rs
 * 职责: 总部-基地供应链管理 (B2B 商城)
 */
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;
use chrono::Utc;
use rand::Rng; // 需要: cargo add rand

use super::AppState;
use crate::models::{
    Claims, HqProduct, SupplyOrder, CreateSupplyOrderPayload, 
    UploadPaymentProofPayload, ShipOrderPayload,
    CreateProductPayload, UpdateProductPayload, ConsumeInventoryPayload
};

// ==========================================
// 1. 基地端：浏览商城 & 采购
// ==========================================

// GET /api/v1/supply/products
pub async fn get_hq_products_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<HqProduct>>, StatusCode> {
    
    // 场景 1: 基地用户 (Base ID 存在) -> 只看上架的
    if let Some(_base_id) = claims.base_id {
        let products = sqlx::query_as::<_, HqProduct>(
            r#"
            SELECT id, name, sku, type, price_cents, stock_quantity, image_url, is_active
            FROM hq_products
            WHERE hq_id = $1 AND is_active = true
            ORDER BY created_at DESC
            "#
        )
        // ★★★ 修复点 1: 这里改为 claims.hq_id ★★★
        .bind(claims.hq_id) 
        .fetch_all(&state.db_pool)
        .await
        .map_err(|e| {
            tracing::error!("Fetch base products failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
        
        return Ok(Json(products));
    }

    // 场景 2: 总部用户 -> 看所有 (上架+下架)
    let products = sqlx::query_as::<_, HqProduct>(
        r#"
        SELECT id, name, sku, type, price_cents, stock_quantity, image_url, is_active
        FROM hq_products
        WHERE hq_id = $1
        ORDER BY is_active DESC, created_at DESC
        "#
    )
    // ★★★ 修复点 2: 这里改为 claims.hq_id ★★★
    .bind(claims.hq_id)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Fetch hq products failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(products))
}
// POST /api/v1/supply/orders
// 基地提交采购订单
pub async fn create_supply_order_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateSupplyOrderPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // 1. 权限校验
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;

    if payload.items.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    // 2. 开启事务
    let mut tx = state.db_pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 3. 计算总价并验证库存
    let mut total_amount_cents = 0;
    let mut order_items_data = Vec::new(); 

    for item in &payload.items {
        // 查商品信息
        let product = sqlx::query!(
            "SELECT name, price_cents, stock_quantity FROM hq_products WHERE id = $1 AND is_active = true FOR UPDATE",
            item.product_id
        )
        .fetch_optional(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        let product = match product {
            Some(p) => p,
            None => return Err(StatusCode::BAD_REQUEST), 
        };

        // ★★★ 修复点：处理 Option 类型，如果库存为 NULL 则视为 0 ★★★
        if product.stock_quantity.unwrap_or(0) < item.quantity {
             return Err(StatusCode::CONFLICT); // 库存不足
        }

        let item_total = product.price_cents * item.quantity;
        total_amount_cents += item_total;

        // 扣减库存 (SQL 会自动处理 NULL 问题，但逻辑上我们已经保证了安全)
        sqlx::query!("UPDATE hq_products SET stock_quantity = stock_quantity - $1 WHERE id = $2", item.quantity, item.product_id)
            .execute(&mut *tx).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        order_items_data.push((item.product_id, product.name, item.quantity, product.price_cents));
    }

    // 4. 生成订单号
    let base_code = sqlx::query_scalar::<_, Option<String>>("SELECT code FROM bases WHERE id = $1")
        .bind(base_id)
        .fetch_one(&mut *tx)
        .await
        .unwrap_or_default()
        .unwrap_or("XXX".to_string());
    
    let date_str = Utc::now().format("%y%m%d").to_string();
    let rand_suffix: String = rand::thread_rng().sample_iter(&rand::distributions::Alphanumeric).take(4).map(char::from).collect();
    let order_no = format!("PUR-{}-{}-{}", base_code, date_str, rand_suffix).to_uppercase();

    // 5. 插入主订单
    let order_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO supply_orders (hq_id, base_id, order_no, total_amount_cents, status)
        VALUES ($1, $2, $3, $4, 'pending_payment')
        RETURNING id
        "#
    )
    .bind(claims.hq_id)
    .bind(base_id)
    .bind(order_no)
    .bind(total_amount_cents)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Create order failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 6. 插入订单明细
    for (p_id, p_name, qty, price) in order_items_data {
        sqlx::query!(
            r#"
            INSERT INTO supply_order_items (supply_order_id, product_id, product_name, quantity, unit_price_cents)
            VALUES ($1, $2, $3, $4, $5)
            "#,
            order_id, p_id, p_name, qty, price
        )
        .execute(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({ "success": true, "order_id": order_id })))
}

// POST /api/v1/supply/orders/:id/payment
// 基地上传付款凭证
pub async fn upload_payment_proof_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(order_id): Path<Uuid>,
    Json(payload): Json<UploadPaymentProofPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // 只能更新自己基地的、未支付的订单
    let result = sqlx::query(
        r#"
        UPDATE supply_orders 
        SET payment_proof_url = $1, updated_at = NOW()
        WHERE id = $2 AND base_id = $3 AND status = 'pending_payment'
        "#
    )
    .bind(payload.proof_url)
    .bind(order_id)
    .bind(claims.base_id) // 安全限制
    .execute(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(Json(serde_json::json!({ "success": true })))
}

// ==========================================
// 2. 总部端：审核与履约
// ==========================================

// GET /api/v1/hq/supply/orders
// 总部查看所有采购单
pub async fn get_all_supply_orders_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<SupplyOrder>>, StatusCode> {
    // 只有总部管理员能看
    let is_hq = claims.roles.iter().any(|r| r == "role.hq.admin" || r == "role.hq.finance");
    if !is_hq { return Err(StatusCode::FORBIDDEN); }

    let orders = sqlx::query_as::<_, SupplyOrder>(
        r#"
        SELECT 
            o.id, o.order_no, o.base_id, o.total_amount_cents, o.status, 
            o.payment_proof_url, o.logistics_info, o.created_at,
            b.name as base_name,
            -- 简单拼接商品名用于列表展示
            (SELECT STRING_AGG(product_name || ' x' || quantity, ', ') FROM supply_order_items WHERE supply_order_id = o.id) as items_summary
        FROM supply_orders o
        LEFT JOIN bases b ON o.base_id = b.id
        WHERE o.hq_id = $1
        ORDER BY o.created_at DESC
        "#
    )
    .bind(claims.hq_id)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Fetch orders failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(orders))
}

// PUT /api/v1/hq/supply/orders/:id/confirm
// 总部确认收款 (pending_payment -> paid)
pub async fn confirm_supply_payment_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(order_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let is_hq_finance = claims.roles.iter().any(|r| r == "role.hq.admin" || r == "role.hq.finance");
    if !is_hq_finance { return Err(StatusCode::FORBIDDEN); }

    sqlx::query(
        "UPDATE supply_orders SET status = 'paid', updated_at = NOW() WHERE id = $1 AND hq_id = $2"
    )
    .bind(order_id)
    .bind(claims.hq_id)
    .execute(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({ "success": true, "status": "paid" })))
}

// PUT /api/v1/hq/supply/orders/:id/ship
// 总部发货 (paid -> shipped)
pub async fn ship_supply_order_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(order_id): Path<Uuid>,
    Json(payload): Json<ShipOrderPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let is_hq_admin = claims.roles.iter().any(|r| r == "role.hq.admin");
    if !is_hq_admin { return Err(StatusCode::FORBIDDEN); }

    // 这里未来可以增加逻辑：如果是“SaaS服务”商品，自动延长基地的有效期
    
    sqlx::query(
        r#"
        UPDATE supply_orders 
        SET status = 'shipped', logistics_info = $1, updated_at = NOW() 
        WHERE id = $2 AND hq_id = $3
        "#
    )
    .bind(payload.logistics_info)
    .bind(order_id)
    .bind(claims.hq_id)
    .execute(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({ "success": true, "status": "shipped" })))
}

pub async fn create_product_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateProductPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // 只有总部管理员能操作 (简单的权限检查)
    // if claims.base_id.is_some() { return Err(StatusCode::FORBIDDEN); }

    sqlx::query(
        r#"
        INSERT INTO hq_products (hq_id, name, sku, type, price_cents, stock_quantity, image_url, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#
    )
    .bind(claims.hq_id)
    .bind(payload.name)
    .bind(payload.sku)
    .bind(payload.type_)
    .bind(payload.price_cents)
    .bind(payload.stock_quantity)
    .bind(payload.image_url)
    .bind(payload.is_active)
    .execute(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Create product failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({ "success": true })))
}

// 3. 更新商品 (PUT /api/v1/supply/products/:id)
// 用于：改价、补货、上下架
pub async fn update_product_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateProductPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // 只有总部管理员能操作
    // if claims.base_id.is_some() { return Err(StatusCode::FORBIDDEN); }

    // 使用 COALESCE 动态更新：如果前端传了 null，就保持原值
    sqlx::query(
        r#"
        UPDATE hq_products 
        SET 
            name = COALESCE($1, name),
            sku = COALESCE($2, sku),
            type = COALESCE($3, type),
            price_cents = COALESCE($4, price_cents),
            stock_quantity = COALESCE($5, stock_quantity),
            image_url = COALESCE($6, image_url),
            is_active = COALESCE($7, is_active)
        WHERE id = $8 AND hq_id = $9
        "#
    )
    .bind(payload.name)
    .bind(payload.sku)
    .bind(payload.type_)
    .bind(payload.price_cents)
    .bind(payload.stock_quantity)
    .bind(payload.image_url)
    .bind(payload.is_active)
    .bind(id)
    .bind(claims.hq_id)
    .execute(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Update product failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({ "success": true })))
}
pub async fn get_base_supply_orders_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<SupplyOrder>>, StatusCode> {
    // 1. 必须是基地用户
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;

    // 2. 只查 base_id = 自己的订单
    let orders = sqlx::query_as::<_, SupplyOrder>(
        r#"
        SELECT 
            o.id, o.order_no, o.base_id, o.total_amount_cents, o.status, 
            o.payment_proof_url, o.logistics_info, o.created_at,
            b.name as base_name,
            -- 子查询拼接商品详情字符串
            (SELECT STRING_AGG(product_name || ' x' || quantity, ', ') 
             FROM supply_order_items 
             WHERE supply_order_id = o.id) as items_summary
        FROM supply_orders o
        LEFT JOIN bases b ON o.base_id = b.id
        WHERE o.base_id = $1
        ORDER BY o.created_at DESC
        "#
    )
    .bind(base_id)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Fetch base supply orders failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(orders))
}

pub async fn get_base_inventory_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;

    let items = sqlx::query!(
        r#"
        SELECT 
            i.product_id, i.quantity, i.last_updated_at,
            p.name, p.sku, p.image_url, p.type as "type_: String"
        FROM base_inventory i
        JOIN hq_products p ON i.product_id = p.id
        WHERE i.base_id = $1
        ORDER BY i.quantity ASC
        "#,
        base_id
    )
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Fetch inventory failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let result = items.into_iter().map(|item| {
        serde_json::json!({
            "product_id": item.product_id,
            "name": item.name,
            "sku": item.sku,
            "image_url": item.image_url,
            "type": item.type_,
            "quantity": item.quantity,
            "last_updated_at": item.last_updated_at
        })
    }).collect();

    Ok(Json(result))
}

// POST /api/v1/base/inventory/:id/consume
// 物资领用/消耗
pub async fn consume_inventory_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(product_id): Path<Uuid>,
    Json(payload): Json<crate::models::ConsumeInventoryPayload>, // 使用 models 里的结构体
) -> Result<Json<serde_json::Value>, StatusCode> {
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;

    if payload.quantity <= 0 { return Err(StatusCode::BAD_REQUEST); }

    let mut tx = state.db_pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 1. 检查库存
    let current_qty = sqlx::query_scalar!(
        "SELECT quantity FROM base_inventory WHERE base_id = $1 AND product_id = $2 FOR UPDATE",
        base_id, product_id
    )
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    if current_qty < payload.quantity {
        return Err(StatusCode::CONFLICT); // 库存不足
    }

    // 2. 扣减库存
    sqlx::query!(
        "UPDATE base_inventory SET quantity = quantity - $1, last_updated_at = NOW() WHERE base_id = $2 AND product_id = $3",
        payload.quantity, base_id, product_id
    )
    .execute(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 3. 写入日志
    let change_amount = -payload.quantity;
    sqlx::query!(
        "INSERT INTO inventory_logs (base_id, product_id, change_amount, reason) VALUES ($1, $2, $3, $4)",
        base_id, product_id, change_amount, payload.reason
    )
    .execute(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({ "success": true })))
}

// GET /api/v1/base/inventory/logs
// 查询库存变动日志
pub async fn get_inventory_logs_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;

    let logs = sqlx::query!(
        r#"
        SELECT 
            l.id, l.change_amount, l.reason, l.created_at,
            p.name as product_name, p.sku, p.image_url
        FROM inventory_logs l
        JOIN hq_products p ON l.product_id = p.id
        WHERE l.base_id = $1
        ORDER BY l.created_at DESC
        LIMIT 100
        "#,
        base_id
    )
    .fetch_all(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result = logs.into_iter().map(|log| {
        serde_json::json!({
            "id": log.id,
            "product_name": log.product_name,
            "sku": log.sku,
            "image_url": log.image_url,
            "change_amount": log.change_amount,
            "reason": log.reason,
            "created_at": log.created_at
        })
    }).collect();

    Ok(Json(result))
}

// PUT /api/v1/supply/orders/:id/receive
// 确认收货入库 (这个之前您加过，但如果 supply.rs 被覆盖了，也得加回来)
pub async fn receive_supply_order_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(order_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;
    let mut tx = state.db_pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let order = sqlx::query!(
        "SELECT status FROM supply_orders WHERE id = $1 AND base_id = $2 FOR UPDATE",
        order_id, base_id
    )
    .fetch_optional(&mut *tx)
    .await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match order {
        Some(o) if o.status.as_deref() == Some("shipped") => {},
        _ => return Err(StatusCode::BAD_REQUEST), 
    }

    let items = sqlx::query!(
        "SELECT product_id, quantity FROM supply_order_items WHERE supply_order_id = $1",
        order_id
    )
    .fetch_all(&mut *tx).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    for item in items {
        sqlx::query!(
            r#"
            INSERT INTO base_inventory (base_id, product_id, quantity)
            VALUES ($1, $2, $3::INT)
            ON CONFLICT (base_id, product_id) 
            DO UPDATE SET quantity = base_inventory.quantity + EXCLUDED.quantity, last_updated_at = NOW()
            "#,
            base_id, item.product_id, item.quantity
        )
        .execute(&mut *tx).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    sqlx::query!("UPDATE supply_orders SET status = 'completed', updated_at = NOW() WHERE id = $1", order_id)
        .execute(&mut *tx).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn restock_inventory_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(product_id): Path<Uuid>,
    Json(payload): Json<crate::models::ConsumeInventoryPayload>, 
) -> Result<Json<serde_json::Value>, StatusCode> {
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;
    if payload.quantity <= 0 { return Err(StatusCode::BAD_REQUEST); }

    let mut tx = state.db_pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 1. 增加库存 (如果不存在则插入)
    sqlx::query!(
        r#"
        INSERT INTO base_inventory (base_id, product_id, quantity)
        VALUES ($1, $2, $3::INT)
        ON CONFLICT (base_id, product_id) 
        DO UPDATE SET quantity = base_inventory.quantity + EXCLUDED.quantity, last_updated_at = NOW()
        "#,
        base_id, product_id, payload.quantity
    )
    .execute(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 2. 写入日志 (change_amount 为正数)
    let change_amount = payload.quantity;
    sqlx::query!(
        "INSERT INTO inventory_logs (base_id, product_id, change_amount, reason) VALUES ($1, $2, $3, $4)",
        base_id, product_id, change_amount, payload.reason
    )
    .execute(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({ "success": true })))
}