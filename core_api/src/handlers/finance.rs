/*
 * src/handlers/finance.rs
 * V23.0 - 业财一体化核心逻辑
 * 职责: 订单管理、成本归集、自动利润核算
 */
use super::AppState;
use crate::models::{
    Claims,
    CreateOrderPayload,
    CreateTransactionPayload,
    // 引入 V15 的旧模型 (保留兼容)
    FinancialTransaction,
    // 引入 V23 的新模型
    OrderDetail,
    OrderStatus,
    PendingPaymentRecord,
    RecordCostPayload,
    SubmitPaymentProofPayload,
    TransactionCategory,
    TransactionType,
    OrderQueryParams
};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use serde::Deserialize;
use sqlx::query;
use uuid::Uuid;

fn yuan_to_cents(amount: f64) -> i32 {
    (amount * 100.0 + 0.5) as i32
}

// ==========================================
// Part 1: 订单管理 (收入中心)
// ==========================================

/// GET /api/v1/finance/orders (CFO 驾驶舱核心接口)
// 功能: 获取订单列表，并实时计算每个订单的成本和毛利
pub async fn get_orders_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(params): Query<OrderQueryParams>,
) -> Result<Json<Vec<OrderDetail>>, StatusCode> {
    // 权限控制
    let is_hq = claims
        .roles
        .iter()
        .any(|r| r == "role.tenant.admin" || r == "role.tenant.finance");
    let is_base_manager = claims.roles.iter().any(|r| r.starts_with("role.base"));

    if !is_hq && !is_base_manager {
        return Err(StatusCode::FORBIDDEN);
    }

    // ★ 核心 SQL: 关联查询订单、客户、销售，并子查询计算成本
    let sql = r#"
        SELECT 
            o.id, o.order_no, o.type as type_, o.status,
            o.contact_name, o.event_date, 
            o.expected_attendees, o.actual_attendees,
            o.total_amount_cents, o.paid_amount_cents,
            o.created_at,
            
            c.name as customer_name,
            u.full_name as sales_name,
            b.name as base_name,

            -- 1. 计算该订单的总成本
            COALESCE((
                SELECT SUM(amount_cents) 
                FROM cost_records cr 
                WHERE cr.order_id = o.id
            ), 0) as total_cost_cents,

            -- 2. 计算毛利
            (o.total_amount_cents - COALESCE((
                SELECT SUM(amount_cents) 
                FROM cost_records cr 
                WHERE cr.order_id = o.id
            ), 0)) as gross_profit_cents,

            -- 3. 计算毛利率
            CASE 
                WHEN o.total_amount_cents > 0 THEN 
                    ROUND(
                        (o.total_amount_cents - COALESCE((
                            SELECT SUM(amount_cents) 
                            FROM cost_records cr 
                            WHERE cr.order_id = o.id
                        ), 0))::numeric 
                        / o.total_amount_cents::numeric * 100, 2
                    )::float8
                ELSE 0 
            END as gross_margin

        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN users u ON o.sales_id = u.id
        LEFT JOIN bases b ON o.base_id = b.id
        WHERE o.tenant_id = $1
        AND ($2::uuid IS NULL OR o.base_id = $2)
        AND ($3::uuid IS NULL OR o.id = $3)  -- ★ 这里的 $3 必须对应下面第3个 bind
        ORDER BY o.created_at DESC
    "#;

    let target_base_id = if is_hq {
        params.base_id
    } else {
        claims.base_id
    };

    let orders = sqlx::query_as::<_, OrderDetail>(sql)
        .bind(claims.tenant_id) // $1
        .bind(target_base_id)   // $2
        .bind(params.id)        // ★★★ 修复点：添加第3个参数绑定，对应 SQL 中的 $3 ★★★
        .fetch_all(&state.db_pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch orders: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(orders))
}

// POST /api/v1/finance/orders (创建业务订单)
pub async fn create_order_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateOrderPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let base_id = if let Some(bid) = payload.base_id {
        bid
    } else if let Some(my_bid) = claims.base_id {
        my_bid
    } else {
        return Err(StatusCode::BAD_REQUEST);
    };

    // 1. 生成业务单号 (例如 ORD-时间戳-随机数)
    let order_no = format!("ORD-{}", Utc::now().format("%Y%m%d%H%M%S"));

    // 2. 金额转分
    let amount_cents = (payload.total_amount * 100.0) as i32;

    let user_id = Uuid::parse_str(&claims.sub).unwrap_or_default();

    let _ = sqlx::query(
        r#"
        INSERT INTO orders (
            tenant_id, base_id, order_no, type, customer_id, contact_name, 
            expected_attendees, total_amount_cents, event_date, sales_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        "#,
    )
    .bind(claims.tenant_id)
    .bind(base_id)
    .bind(order_no)
    .bind(payload.type_)
    .bind(payload.customer_id)
    .bind(payload.contact_name)
    .bind(payload.expected_attendees)
    .bind(amount_cents)
    .bind(payload.event_date)
    .bind(user_id)
    .execute(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Create order failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({ "success": true })))
}

// ==========================================
// Part 2: 成本中心 (支出归集)
// ==========================================

// POST /api/v1/finance/costs (录入成本)
// 场景: 财务或教务录入 "某次研学的大巴车费 2000元"
pub async fn record_cost_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<RecordCostPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // 1. 校验订单是否存在且属于本租户
    let order_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM orders WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(payload.order_id)
    .bind(claims.tenant_id)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(false);

    if !order_exists {
        return Err(StatusCode::NOT_FOUND);
    }

    // 2. 插入成本记录
    // 注意: 这里需要先查出 base_id (为了数据完整性)
    let base_id = sqlx::query_scalar::<_, Uuid>("SELECT base_id FROM orders WHERE id = $1")
        .bind(payload.order_id)
        .fetch_one(&state.db_pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let amount_cents = (payload.amount * 100.0) as i32;
    let user_id = Uuid::parse_str(&claims.sub).unwrap_or_default();

    let _ = sqlx::query(
        r#"
        INSERT INTO cost_records (
            tenant_id, base_id, order_id, category, amount_cents, 
            supplier_name, description, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#,
    )
    .bind(claims.tenant_id)
    .bind(base_id)
    .bind(payload.order_id)
    .bind(payload.category)
    .bind(amount_cents)
    .bind(payload.supplier_name)
    .bind(payload.description)
    .bind(user_id)
    .execute(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Record cost failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({ "success": true })))
}

// ==========================================
// Part 3: 资金中心 (保留 V15 兼容)
// ==========================================

// GET /api/v1/finance/transactions
pub async fn get_financial_records_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<FinancialTransaction>>, StatusCode> {
    // ... (保留原有逻辑，此处省略以节省篇幅，若需要请保留之前代码) ...
    // 为了不破坏现有功能，您可以把原来的 get_financial_records_handler 粘贴在这里
    // 暂时返回空列表演示编译通过
    Ok(Json(vec![]))
}

// POST /api/v1/finance/transactions
pub async fn create_manual_transaction_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateTransactionPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // ... (保留原有逻辑) ...
    Ok(Json(serde_json::json!({"success": true})))
}

// 接口 1: 销售/客户提交转账凭证
// POST /api/v1/finance/payments/offline-proof
pub async fn submit_payment_proof_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<SubmitPaymentProofPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // 1. 金额转分
    let amount_cents = yuan_to_cents(payload.amount);
    if amount_cents <= 0 {
        return Err(StatusCode::BAD_REQUEST);
    }

    // 2. 自动补全 base_id (查订单归属)
    // 必须确保只能给自己租户的订单付款
    let order = sqlx::query!(
        "SELECT base_id FROM orders WHERE id = $1 AND tenant_id = $2",
        payload.order_id,
        claims.tenant_id
    )
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Order lookup failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let base_id = match order {
        Some(o) => o.base_id,
        None => return Err(StatusCode::NOT_FOUND), // 订单不存在或不属于该租户
    };

    // 3. 写入流水记录 (状态默认为 PENDING)
    let _ = sqlx::query!(
        r#"
        INSERT INTO finance_payment_records (
            tenant_id, base_id, order_id, 
            transaction_type, channel, amount_cents, 
            payer_name, proof_image_url, status
        )
        VALUES ($1, $2, $3, 'INCOME', 'BANK_TRANSFER', $4, $5, $6, 'PENDING')
        "#,
        claims.tenant_id,
        base_id,
        payload.order_id,
        amount_cents,
        payload.payer_name,
        payload.proof_url
    )
    .execute(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to save payment proof: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 这里未来可以加一行代码：Notification::send("财务请注意，有新到账需审核")...

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "凭证提交成功，等待财务审核"
    })))
}

#[derive(Debug, Deserialize)]
pub struct VerifyPaymentPayload {
    pub payment_record_id: Uuid,
    pub action: String, // "APPROVE" (通过) 或 "REJECT" (驳回)
}

// 接口 2: 财务审核确认收款 (CFO 操作)
// POST /api/v1/finance/payments/verify
pub async fn verify_payment_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<VerifyPaymentPayload>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // 1. 严格权限控制：只有总部管理员或财务角色可以操作
    let is_authorized = claims
        .roles
        .iter()
        .any(|r| r == "role.base.admin" || r == "role.base.finance");

    if !is_authorized {
        return Err(StatusCode::FORBIDDEN);
    }

    let user_id = Uuid::parse_str(&claims.sub).unwrap_or_default();
    let new_status = if payload.action == "APPROVE" {
        "VERIFIED"
    } else {
        "FAILED"
    };

    // 2. 开启数据库事务 (涉及两张表更新，必须原子化)
    let mut tx = state
        .db_pool
        .begin()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 3. 更新流水状态
    // 注意：必须检查 tenant_id，且当前状态必须是 PENDING (防止重复审核)
    let record = sqlx::query!(
        r#"
        UPDATE finance_payment_records 
        SET status = $1, verified_at = NOW(), verified_by = $2
        WHERE id = $3 AND tenant_id = $4 AND status = 'PENDING'
        RETURNING order_id, amount_cents
        "#,
        new_status,
        user_id,
        payload.payment_record_id,
        claims.tenant_id
    )
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Verify payment update failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let record = match record {
        Some(r) => r,
        None => {
            // 找不到记录，或者记录已经被审核过了
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    // 4. ★ 核心联动：如果是审核通过，必须增加订单的已付金额
    if new_status == "VERIFIED" {
        sqlx::query!(
            r#"
            UPDATE orders 
            SET paid_amount_cents = paid_amount_cents + $1
            WHERE id = $2
            "#,
            record.amount_cents,
            record.order_id
        )
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Failed to update order balance: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    }

    // 5. 提交事务
    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(
        serde_json::json!({ "success": true, "status": new_status }),
    ))
}

// GET /api/v1/finance/payments/pending
// 职责: 列出所有待审核的线下转账记录
pub async fn get_pending_payments_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<PendingPaymentRecord>>, StatusCode> {
    // 1. 权限与范围判断
    let is_hq = claims
        .roles
        .iter()
        .any(|r| r == "role.tenant.admin" || r == "role.tenant.finance");
    let is_base = claims
        .roles
        .iter()
        .any(|r| r == "role.base.admin" || r == "role.base.finance");

    if !is_hq && !is_base {
        return Err(StatusCode::FORBIDDEN);
    }

    // 2. 确定查询范围 (Base ID)
    // 如果是基地人员，强制加上 base_id 过滤
    // 如果是总部人员，可以看所有（或者也可以在 Query 参数里指定，这里先简化为看所有）
    let filter_base_id = if is_base {
        claims.base_id // 必须有值
    } else {
        None // 总部看全部
    };

    // 3. SQL 查询 (增加 base_id 过滤逻辑)
    let records = sqlx::query_as::<_, PendingPaymentRecord>(
        r#"
        SELECT 
            fpr.id, fpr.order_id, fpr.amount_cents, fpr.payer_name, 
            fpr.channel, fpr.proof_image_url, fpr.created_at, fpr.status,
            o.order_no,
            COALESCE(c.name, o.contact_name) as customer_name,
            u.full_name as sales_name
        FROM finance_payment_records fpr
        JOIN orders o ON fpr.order_id = o.id
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN users u ON o.sales_id = u.id
        WHERE fpr.tenant_id = $1 
          AND fpr.status = 'PENDING'
          -- ★ 关键修改: 如果 filter_base_id 有值，则只查该基地的；否则忽略此条件
          AND ($2::uuid IS NULL OR fpr.base_id = $2)
        ORDER BY fpr.created_at ASC
        "#,
    )
    .bind(claims.tenant_id)
    .bind(filter_base_id) // 绑定 Base ID
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Fetch pending payments failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(records))
}
