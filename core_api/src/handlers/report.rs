/*
 * src/handlers/report.rs
 * 职责: 数据报表 - Data Reports & Analytics
 */
use axum::{extract::State, http::StatusCode, Json};
use super::AppState;
use crate::models::Claims;

// ==========================================
// 1. Top Products Report
// ==========================================

#[derive(serde::Serialize)]
pub struct TopProductItem {
    pub id: i32,
    pub name: String,
    pub category: String,
    #[serde(rename = "type")]
    pub type_: String,
    pub sales: i64,
    pub amount: String,
}

// GET /api/v1/hq/reports/top-products
pub async fn get_top_products_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<TopProductItem>>, StatusCode> {
    if !claims.roles.iter().any(|r| r == "role.hq.admin") {
        return Err(StatusCode::FORBIDDEN);
    }

    let hq_id = claims.hq_id;

    // Get top selling products/items from order_items
    let products = sqlx::query_as::<_, (Option<i64>, String, Option<String>, Option<String>, Option<i64>, Option<i64>)>(
        r#"
        SELECT 
            ROW_NUMBER() OVER (ORDER BY SUM(oi.total_price_cents) DESC) as row_num,
            oi.name,
            CASE 
                WHEN oi.name LIKE '%课%' THEN '课程'
                WHEN oi.name LIKE '%教具%' OR oi.name LIKE '%机器%' THEN '教具'
                ELSE '物料'
            END as category,
            CASE 
                WHEN oi.name LIKE '%课%' THEN 'course'
                ELSE 'material'
            END as type_,
            COUNT(*) as sales_count,
            SUM(oi.total_price_cents) as total_amount
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.hq_id = $1
        AND o.status IN ('paid', 'completed')
        AND o.created_at >= NOW() - INTERVAL '90 days'
        GROUP BY oi.name
        ORDER BY total_amount DESC
        LIMIT 5
        "#,
    )
    .bind(hq_id)
    .fetch_all(&state.db_pool)
    .await
    .unwrap_or(vec![]);

    let result = products.into_iter().map(|(row_num, name, category, type_, sales_count, total_amount)| {
        let amount = (total_amount.unwrap_or(0) as f64) / 100.0;
        TopProductItem {
            id: row_num.unwrap_or(0) as i32,
            name,
            category: category.unwrap_or("其他".to_string()),
            type_: type_.unwrap_or("material".to_string()),
            sales: sales_count.unwrap_or(0),
            amount: format!("{:.0}", amount),
        }
    }).collect();



    Ok(Json(result))
}

// ==========================================
// 2. Order Trend Report
// ==========================================

#[derive(serde::Serialize)]
pub struct OrderTrendData {
    pub labels: Vec<String>,
    pub values: Vec<i64>,
}

// GET /api/v1/hq/reports/order-trend
pub async fn get_order_trend_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<OrderTrendData>, StatusCode> {
    if !claims.roles.iter().any(|r| r == "role.hq.admin") {
        return Err(StatusCode::FORBIDDEN);
    }

    let hq_id = claims.hq_id;

    // Get last 6 months order trend
    let trends = sqlx::query_as::<_, (Option<String>, Option<i64>)>(
        r#"
        SELECT 
            TO_CHAR(d, 'MM月') as month_label,
            COALESCE(SUM(o.total_amount_cents), 0) as monthly_total
        FROM generate_series(
            date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
            date_trunc('month', CURRENT_DATE),
            '1 month'
        ) as d
        LEFT JOIN orders o ON 
            date_trunc('month', o.created_at) = d 
            AND o.hq_id = $1
            AND o.status IN ('paid', 'completed')
        GROUP BY d
        ORDER BY d
        "#,
    )
    .bind(hq_id)
    .fetch_all(&state.db_pool)
    .await
    .unwrap_or(vec![]);

    let labels: Vec<String> = trends.iter()
        .map(|(month_label, _)| month_label.clone().unwrap_or("--".to_string()))
        .collect();

    let values: Vec<i64> = trends.iter()
        .map(|(_, monthly_total)| (monthly_total.unwrap_or(0) / 10000) as i64) // Convert to 万元
        .collect();


    Ok(Json(OrderTrendData { labels, values }))
}

// ==========================================
// 3. Franchise Funnel Data
// ==========================================

#[derive(serde::Serialize)]
pub struct FunnelData {
    pub leads: i64,
    pub contracts: i64,
    pub first_orders: i64,
    pub contract_rate: i64,
    pub order_rate: i64,
}

// GET /api/v1/hq/reports/funnel
pub async fn get_funnel_data_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<FunnelData>, StatusCode> {
    if !claims.roles.iter().any(|r| r == "role.hq.admin") {
        return Err(StatusCode::FORBIDDEN);
    }

    let hq_id = claims.hq_id;

    // 1. Leads count (total bases created)
    let leads = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM bases WHERE hq_id = $1"
    )
    .bind(hq_id)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(0);

    // 2. Contracts (bases with auth dates set)
    let contracts = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM bases WHERE hq_id = $1 AND auth_start_date IS NOT NULL"
    )
    .bind(hq_id)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(0);

    // 3. First orders (bases that have placed at least one supply order)
    let first_orders = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(DISTINCT base_id) 
        FROM supply_orders 
        WHERE status IN ('paid', 'shipped', 'completed')
        "#
    )
    .bind(hq_id)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(0);

    // Calculate conversion rates
    let contract_rate = if leads > 0 {
        (contracts * 100) / leads
    } else {
        0
    };

    let order_rate = if contracts > 0 {
        (first_orders * 100) / contracts
    } else {
        0
    };

    Ok(Json(FunnelData {
        leads,
        contracts,
        first_orders,
        contract_rate,
        order_rate,
    }))
}
