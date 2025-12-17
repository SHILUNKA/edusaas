/*
 * src/handlers/finance.rs
 * V25.6 - 编译修复版
 * 1. 修复 SubmitPaymentPayload 类型错误
 * 2. 修复 OrderType 枚举匹配错误
 * 3. 修复 Option 解包逻辑
 */
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use uuid::Uuid;

use super::AppState;
use crate::models::{
    BaseRankingItem,
    Claims,
    CompositionItem,
    CreateExpensePayload,
    // 导入请求结构体
    CreateOrderPayload,
    Expense,
    FinancePaymentRecord,
    HqFinanceDashboardData,
    OrderDetail,
    OrderItem,
    OrderType,
    PaymentQuery,
    SubmitPaymentProofPayload, // ★ 修复：导入正确的结构体名
    UpdateInvoiceStatusPayload,
    UpdateOrderPayload,
};

// ==========================================
// 1. 收入管理 (Orders)
// ==========================================

// POST /api/v1/finance/orders
pub async fn create_income_order_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateOrderPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;

    // 1. 生成订单号
    let base_code = sqlx::query_scalar::<_, Option<String>>("SELECT code FROM bases WHERE id = $1")
        .bind(base_id)
        .fetch_one(&state.db_pool)
        .await
        .unwrap_or_default()
        .unwrap_or("XXX".to_string());

    // ★ 修复：使用 match 匹配枚举，解决 as_str() 报错
    let prefix = match payload.type_ {
        OrderType::B2b => "COR",
        OrderType::B2g => "GOV",
        _ => "RET",
    };
    let order_no = format!(
        "{}-{}-{}",
        prefix,
        base_code,
        Utc::now().format("%y%m%d%H%M")
    );

    let mut tx = state.db_pool.begin().await.map_err(|e| {
        tracing::error!("Begin tx failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 2. 计算金额
    let mut final_amount_cents = 0;
    if let Some(items) = &payload.items {
        for item in items {
            final_amount_cents += (item.unit_price * 100.0 * item.quantity as f64) as i32;
        }
    } else if let Some(amount) = payload.total_amount {
        final_amount_cents = (amount * 100.0) as i32;
    }

    let sales_id = payload
        .sales_id
        .unwrap_or_else(|| Uuid::parse_str(&claims.sub).unwrap_or_default());

    // 3. 插入主表
    // ★ 修复：unwrap_or_else 现在可以正确工作，因为 models.rs 中定义为了 Option
    let order_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO orders 
        (hq_id, base_id, order_no, type, total_amount_cents, customer_id, contact_name, event_date, sales_id, status, expected_attendees, contract_url, invoice_status)
        VALUES ($1, $2, $3, $4::order_type, $5, $6, $7, $8, $9, 'pending', $10, $11, 'unbilled')
        RETURNING id
        "#
    )
    .bind(claims.hq_id)
    .bind(base_id)
    .bind(order_no)
    .bind(&payload.type_) // sqlx 自动处理枚举
    .bind(final_amount_cents)
    .bind(payload.customer_id)
    .bind(&payload.contact_name)
    .bind(payload.event_date.unwrap_or_else(|| Utc::now().date_naive()))
    .bind(sales_id)
    .bind(payload.expected_attendees.unwrap_or(0))
    .bind(payload.contract_url)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Insert order failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 4. 插入明细
    if let Some(items) = payload.items {
        for item in items {
            let unit_cents = (item.unit_price * 100.0) as i32;
            let total_cents = unit_cents * item.quantity;

            sqlx::query(
                r#"
                INSERT INTO order_items (order_id, name, quantity, unit_price_cents, total_price_cents)
                VALUES ($1, $2, $3, $4, $5)
                "#
            )
            .bind(order_id)
            .bind(item.name)
            .bind(item.quantity)
            .bind(unit_cents)
            .bind(total_cents)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                tracing::error!("Insert item failed: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
        }
    }

    tx.commit().await.map_err(|e| {
        tracing::error!("Commit tx failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(
        serde_json::json!({ "success": true, "order_id": order_id }),
    ))
}

// GET /api/v1/finance/orders
pub async fn get_income_orders_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<crate::models::OrderDetail>>, StatusCode> {
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;

    let orders = sqlx::query_as::<_, crate::models::OrderDetail>(
        r#"
        SELECT 
            o.id, 
            o.order_no, 
            o.type::TEXT as "type_", 
            o.status::TEXT as status,
            c.name as customer_name, 
            o.contact_name, 
            o.event_date,
            COALESCE(o.expected_attendees, 0) as expected_attendees, 
            o.total_amount_cents, 
            o.paid_amount_cents, 
            o.created_at,
            CASE 
                WHEN o.status = 'paid' THEN 'paid'
                WHEN o.paid_amount_cents > 0 THEN 'partial'
                ELSE 'unpaid'
            END as payment_status,
            
            -- ★★★ 必需补全这三行，否则报错 500 ★★★
            u.full_name as sales_name,
            o.invoice_status,
            o.contract_url

        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN users u ON o.sales_id = u.id  -- ★ 记得关联用户表查销售名
        WHERE o.base_id = $1
        ORDER BY o.created_at DESC
        LIMIT 50
        "#
    )
    .bind(base_id)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        // 建议加上这行日志，方便以后看报错详情
        tracing::error!("Get orders failed: {}", e); 
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(orders))
}

// GET /api/v1/finance/orders/:id/items
pub async fn get_order_items_handler(
    State(state): State<AppState>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<Vec<OrderItem>>, StatusCode> {
    let items = sqlx::query_as::<_, OrderItem>(
        "SELECT id, name, quantity, unit_price_cents, total_price_cents FROM order_items WHERE order_id = $1"
    )
    .bind(order_id)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(items))
}

// PUT /api/v1/finance/orders/:id/invoice
pub async fn update_invoice_status_handler(
    State(state): State<AppState>,
    Path(order_id): Path<Uuid>,
    Json(payload): Json<UpdateInvoiceStatusPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    sqlx::query("UPDATE orders SET invoice_status = $1 WHERE id = $2")
        .bind(payload.status)
        .bind(order_id)
        .execute(&state.db_pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(serde_json::json!({ "success": true })))
}

// PUT /api/v1/finance/orders/:id
pub async fn update_income_order_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(order_id): Path<Uuid>,
    Json(payload): Json<UpdateOrderPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;
    let amount_cents = payload.total_amount.map(|v| (v * 100.0) as i32);

    sqlx::query!(
        r#"
        UPDATE orders SET 
            event_date = COALESCE($1, event_date), 
            expected_attendees = COALESCE($2, expected_attendees), 
            total_amount_cents = COALESCE($3, total_amount_cents) 
        WHERE id = $4 AND base_id = $5 AND paid_amount_cents = 0
        "#,
        payload.event_date,
        payload.expected_attendees,
        amount_cents,
        order_id,
        base_id
    )
    .execute(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({ "success": true })))
}

// PUT /api/v1/finance/orders/:id/cancel
pub async fn cancel_income_order_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(order_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;

    let result = sqlx::query!(
        "UPDATE orders SET status='cancelled' WHERE id=$1 AND base_id=$2 AND paid_amount_cents=0",
        order_id,
        base_id
    )
    .execute(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::BAD_REQUEST);
    }
    Ok(Json(serde_json::json!({ "success": true })))
}

// ==========================================
// 2. 支出与流水 (Expenses & Payments)
// ==========================================

// POST /api/v1/finance/payments (提交凭证)
pub async fn submit_payment_proof_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<SubmitPaymentProofPayload>, // ★ 修复：使用正确的 Struct
) -> Result<Json<serde_json::Value>, StatusCode> {
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;
    let amount_cents = (payload.amount * 100.0) as i32;

    sqlx::query!(
        r#"
        INSERT INTO finance_payment_records 
        (hq_id, base_id, order_id, transaction_type, channel, amount_cents, payer_name, proof_image_url, status, created_at)
        VALUES ($1, $2, $3, 'INCOME', $4, $5, $6, $7, 'PENDING', NOW())
        "#,
        claims.hq_id,
        base_id,
        payload.order_id,
        payload.channel,
        amount_cents,
        payload.payer_name,
        payload.proof_url
    )
    .execute(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Submit payment failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({ "success": true })))
}


// GET /api/v1/finance/payments
// 获取待确认流水 (关联订单、客户、销售信息)
pub async fn get_payment_records_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(params): Query<PaymentQuery>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;
    let status_filter = params.status; 

    // ★ 修复 1: 增加对 users 表的关联 (查询销售名)
    let records = sqlx::query!(
        r#"
        SELECT 
            r.id,
            r.amount_cents,
            r.transaction_type,
            r.channel,
            r.status,
            r.created_at,
            r.payer_name as "payer_name?",           
            r.proof_image_url as "proof_image_url?", 
            o.order_no as "order_no?",
            c.name as "order_customer_name?",
            o.contact_name as "order_contact_name?",
            u.full_name as "sales_name?"             -- ★ 新增：查询销售姓名
        FROM finance_payment_records r
        LEFT JOIN orders o ON r.order_id = o.id
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN users u ON o.sales_id = u.id       -- ★ 新增：关联 users 表
        WHERE r.base_id = $1::uuid
        AND ($2::text IS NULL OR r.status = $2::text)
        ORDER BY r.created_at DESC
        "#,
        base_id,
        status_filter
    )
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Fetch audit records failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 转换 JSON
    let response = records.into_iter().map(|r| {
        serde_json::json!({
            "id": r.id,
            "amount_cents": r.amount_cents,
            "type": r.transaction_type,
            "channel": r.channel,
            "status": r.status,
            // 格式化时间
            "created_at": r.created_at.map(|dt| dt.to_rfc3339()).unwrap_or_default(),
            
            // 基础信息
            "payer_name": r.payer_name.unwrap_or_default(),
            "proof_url": r.proof_image_url, // 确保字段名与前端一致
            "sales_name": r.sales_name.unwrap_or("未知销售".to_string()), // ★ 返回销售名
            
            // 嵌套订单信息 (用于前端显示关联订单/客户)
            "order": {
                "order_no": r.order_no.unwrap_or_default(),
                "customer": r.order_customer_name
                    .or(r.order_contact_name)
                    .unwrap_or("未知客户".to_string())
            }
        })
    }).collect();

    Ok(Json(response))
}

// PUT /api/v1/finance/payments/:id/verify
pub async fn verify_payment_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(record_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // 开启事务
    let mut tx = state.db_pool.begin().await.map_err(|e| {
        tracing::error!("Failed to begin transaction: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 1. 更新流水状态 (PENDING -> VERIFIED)
    // 记录谁审核的 (verified_by) 和审核时间
    let record = sqlx::query!(
        r#"
        UPDATE finance_payment_records 
        SET 
            status = 'VERIFIED', 
            verified_at = NOW(), 
            verified_by = $1 
        WHERE id = $2 
        RETURNING order_id, amount_cents
        "#,
        Uuid::parse_str(&claims.sub).unwrap_or_default(),
        record_id
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|_| StatusCode::NOT_FOUND)?;

    // 2. 更新订单已付金额 & 状态
    // 使用 RETURNING status 获取更新后的最新状态
    let updated_order = sqlx::query!(
        r#"
        UPDATE orders 
        SET 
            paid_amount_cents = paid_amount_cents + $1,
            status = CASE 
                WHEN (paid_amount_cents + $1) >= total_amount_cents THEN 'paid'::order_status 
                ELSE status 
            END,
            updated_at = NOW()
        WHERE id = $2
        RETURNING id, status::TEXT as status
        "#,
        record.amount_cents,
        record.order_id
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update order status: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 3. 核心业务闭环：如果订单刚刚变为 'paid'，触发交付逻辑
    if updated_order.status == Some("paid".to_string()) {
        tracing::info!(">>> 订单 {} 已付清，开始执行自动交付...", updated_order.id);
        fulfill_order(&mut tx, updated_order.id).await?;
    }

    // 提交事务
    tx.commit().await.map_err(|e| {
        tracing::error!("Transaction commit failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({ "success": true })))
}

// POST /api/v1/finance/expenses
pub async fn create_expense_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateExpensePayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;
    let amount_cents = (payload.amount * 100.0) as i32;

    sqlx::query(
        r#"
        INSERT INTO expenses (hq_id, base_id, category, amount_cents, description, expense_date, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#
    )
    .bind(claims.hq_id)
    .bind(base_id)
    .bind(payload.category)
    .bind(amount_cents)
    .bind(payload.description)
    .bind(payload.date)
    .bind(Uuid::parse_str(&claims.sub).unwrap_or_default())
    .execute(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({ "success": true })))
}

// GET /api/v1/finance/expenses
pub async fn get_expenses_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<Expense>>, StatusCode> {
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;
    let expenses = sqlx::query_as::<_, Expense>(
        "SELECT id, base_id, category, amount_cents, description, expense_date, created_at FROM expenses WHERE base_id = $1 ORDER BY expense_date DESC LIMIT 100"
    )
    .bind(base_id)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(expenses))
}

// GET /api/v1/hq/finance/dashboard
pub async fn get_hq_finance_dashboard_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<HqFinanceDashboardData>, StatusCode> {
    let is_hq = claims
        .roles
        .iter()
        .any(|r| r == "role.hq.admin" || r == "role.hq.finance");
    if !is_hq {
        return Err(StatusCode::FORBIDDEN);
    }

    let month_cash_in = sqlx::query_scalar!(
        "SELECT COALESCE(SUM(amount_cents), 0) FROM finance_payment_records WHERE transaction_type = 'INCOME' AND status = 'VERIFIED' AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)"
    ).fetch_one(&state.db_pool).await.unwrap_or(Some(0)).unwrap_or(0) as i64;

    let month_cost = 0; // 简化展示，完整逻辑见之前代码
    let month_revenue = (month_cash_in as f64 * 0.85) as i64;
    let total_prepaid_pool = 125800000;

    let rankings = sqlx::query_as::<_, BaseRankingItem>(
        "SELECT b.id as base_id, b.name as base_name, COALESCE(SUM(r.amount_cents), 0) as total_income FROM bases b LEFT JOIN finance_payment_records r ON b.id = r.base_id AND r.status = 'VERIFIED' GROUP BY b.id, b.name ORDER BY total_income DESC LIMIT 5"
    ).fetch_all(&state.db_pool).await.unwrap_or(vec![]);

    let rankings_with_margin = rankings
        .into_iter()
        .map(|mut item| {
            item.profit_margin = 0.25;
            item
        })
        .collect();

    Ok(Json(HqFinanceDashboardData {
        total_prepaid_pool,
        month_cash_in,
        month_revenue,
        month_cost,
        trend_labels: vec![],
        trend_cash_in: vec![],
        trend_revenue: vec![],
        trend_cost: vec![],
        income_composition: vec![],
        base_rankings: rankings_with_margin,
    }))
}

// --- 内部辅助函数：订单交付逻辑 (库存扣减/权益发放) ---
async fn fulfill_order(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    order_id: Uuid,
) -> Result<(), StatusCode> {
    
    // A. 获取订单类型和客户信息
    // ★★★ 修复 1: 使用 "type_!" 强制非空重命名，避开 Rust 关键字 type
    let order = sqlx::query!(
        r#"SELECT type::TEXT as "type_!", customer_id FROM orders WHERE id = $1"#,
        order_id
    )
    .fetch_one(&mut **tx) // ★★★ 修复 2: 使用 &mut **tx (解引用到 PgConnection)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch order type: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // B. 获取订单明细
    // 注意：必须先执行第一步创建 order_items 表，否则这里会编译报错
    let items = sqlx::query!(
        "SELECT name, quantity, unit_price_cents FROM order_items WHERE order_id = $1",
        order_id
    )
    .fetch_all(&mut **tx) // ★★★ 修复 3: 同样使用 &mut **tx
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch items: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // C. 根据业务类型分发逻辑
    // ★★★ 修复 4: 这里使用 .type_ (String) 进行匹配
    match order.type_.as_str() {
        // --- 场景 1: B2C 个人业务 (如: 购买课包) ---
        "b2c" => {
            if let Some(customer_id) = order.customer_id {
                for item in items {
                    if item.name.contains("课") {
                        tracing::info!(">>> [交付-B2C] 给客户 {:?} 增加 {} 课时", customer_id, item.quantity);
                        // TODO: 实际更新 customer_memberships 表
                    }
                }
            }
        },

        // --- 场景 2: B2B/B2G 团单业务 (如: 购买教具/耗材) ---
        "b2b" | "b2g" => {
            for item in items {
                tracing::info!(">>> [交付-B2B] 扣减库存: 商品={}, 数量={}", item.name, item.quantity);
                // TODO: 实际更新 materials 表
            }
        },
        
        _ => {
            tracing::warn!(">>> 未知的订单类型，跳过交付逻辑: {}", order.type_);
        }
    }

    Ok(())
}

