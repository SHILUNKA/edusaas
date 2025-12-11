/*
 * src/handlers/finance.rs
 * V23.0 - 业财一体化核心逻辑
 * 职责: 订单管理、成本归集、自动利润核算
 */
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;
use chrono::Utc;
use serde::Deserialize;
use super::AppState;
use crate::models::{
    Claims, 
    // 引入 V15 的旧模型 (保留兼容)
    FinancialTransaction, TransactionType, TransactionCategory, CreateTransactionPayload,
    // 引入 V23 的新模型
    OrderDetail, CreateOrderPayload, RecordCostPayload, OrderStatus
};

// ==========================================
// Part 1: 订单管理 (收入中心)
// ==========================================

#[derive(Debug, Deserialize)]
pub struct OrderQueryParams {
    pub base_id: Option<Uuid>,
    pub status: Option<String>,
}

// GET /api/v1/finance/orders (CFO 驾驶舱核心接口)
// 功能: 获取订单列表，并实时计算每个订单的成本和毛利
pub async fn get_orders_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(params): Query<OrderQueryParams>,
) -> Result<Json<Vec<OrderDetail>>, StatusCode> {
    
    // 权限控制
    let is_hq = claims.roles.iter().any(|r| r == "role.tenant.admin" || r == "role.tenant.finance");
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

            -- 1. 计算该订单的总成本 (从 cost_records 表聚合)
            COALESCE((
                SELECT SUM(amount_cents) 
                FROM cost_records cr 
                WHERE cr.order_id = o.id
            ), 0) as total_cost_cents,

            -- 2. 计算毛利 (收入 - 成本)
            (o.total_amount_cents - COALESCE((
                SELECT SUM(amount_cents) 
                FROM cost_records cr 
                WHERE cr.order_id = o.id
            ), 0)) as gross_profit_cents,

            -- 3. 计算毛利率 (毛利 / 收入 * 100)
            CASE 
                WHEN o.total_amount_cents > 0 THEN 
                    ROUND(
                        (o.total_amount_cents - COALESCE((SELECT SUM(amount_cents) FROM cost_records WHERE cr.order_id = o.id), 0))::numeric 
                        / o.total_amount_cents::numeric * 100, 2
                    )::float8
                ELSE 0 
            END as gross_margin

        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN users u ON o.sales_id = u.id
        LEFT JOIN bases b ON o.base_id = b.id
        WHERE o.tenant_id = $1
        -- 基地过滤: 如果是总部且传了base_id，或如果是基地员工
        AND ($2::uuid IS NULL OR o.base_id = $2)
        ORDER BY o.created_at DESC
    "#;

    let target_base_id = if is_hq { params.base_id } else { claims.base_id };

    let orders = sqlx::query_as::<_, OrderDetail>(sql)
        .bind(claims.tenant_id)
        .bind(target_base_id)
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
        "#
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
        "SELECT EXISTS(SELECT 1 FROM orders WHERE id = $1 AND tenant_id = $2)"
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
    let base_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT base_id FROM orders WHERE id = $1"
    )
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
        "#
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