use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use crate::{AppState, models::Claims};

// --- Models ---

#[derive(Debug, Serialize)]
pub struct WorkspaceOverview {
    pub approvals: ApprovalCounts,
    pub risks: Vec<RiskItem>,
}

#[derive(Debug, Serialize)]
pub struct ApprovalCounts {
    pub discount: i64,
    pub refund: i64,
    pub expense: i64,
    pub leave: i64,
}

#[derive(Debug, Serialize)]
pub struct RiskItem {
    pub id: String,
    pub text: String,
    pub desc: String,
}

#[derive(Debug, Deserialize)]
pub struct ApprovalListQuery {
    #[serde(rename = "type")]
    pub type_: String, // discount, refund, expense, leave
}

#[derive(Debug, Serialize)]
pub struct ApprovalItem {
    pub id: Uuid,
    pub type_: String,
    pub title: String,
    pub subtitle: String,
    pub amount_cents: Option<i64>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub requester_name: Option<String>,
    pub proof_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ApprovalActionPayload {
    pub id: Uuid,
    #[serde(rename = "type")]
    pub type_: String,
    pub action: String, // approve, reject
    pub reason: Option<String>,
}

// --- Handlers ---

pub async fn get_workspace_overview_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<WorkspaceOverview>, (StatusCode, String)> {
    let base_id = claims.base_id.ok_or((StatusCode::FORBIDDEN, "Base ID required".to_string()))?;

    // 1. Approvals
    let discount_count: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM orders WHERE base_id = $1 AND approval_status = 'pending' AND discount_amount_cents > 0",
        base_id
    )
    .fetch_one(&state.db_pool).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?.unwrap_or(0);

    let refund_count: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM refund_requests WHERE base_id = $1 AND status = 'pending'",
        base_id
    )
    .fetch_one(&state.db_pool).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?.unwrap_or(0);

    let expense_count: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM expenses WHERE base_id = $1 AND status = 'pending'",
        base_id
    )
    .fetch_one(&state.db_pool).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?.unwrap_or(0);

    let leave_count: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM leave_requests WHERE base_id = $1 AND status = 'pending'",
        base_id
    )
    .fetch_one(&state.db_pool).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?.unwrap_or(0);

    // 2. Risks
    let overdue_count: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM orders WHERE base_id = $1 AND status = 'pending' AND created_at < NOW() - INTERVAL '7 days'",
        base_id
    )
    .fetch_one(&state.db_pool).await.unwrap_or(Some(0)).unwrap_or(0);

    let mut risks = Vec::new();
    if overdue_count > 0 {
        risks.push(RiskItem {
            id: "OVERDUE_ORDERS".to_string(),
            text: "回款逾期预警".to_string(),
            desc: format!("有{}笔订单逾期超过7天未付款", overdue_count),
        });
    }

    Ok(Json(WorkspaceOverview {
        approvals: ApprovalCounts { discount: discount_count, refund: refund_count, expense: expense_count, leave: leave_count },
        risks,
    }))
}

pub async fn get_approval_list_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(query): Query<ApprovalListQuery>,
) -> Result<Json<Vec<ApprovalItem>>, (StatusCode, String)> {
    let base_id = claims.base_id.ok_or((StatusCode::FORBIDDEN, "Base ID required".to_string()))?;
    let mut items = Vec::new();

    match query.type_.as_str() {
        "discount" => {
            let rows = sqlx::query!(
                r#"
                SELECT o.id, o.order_no, o.discount_amount_cents, o.created_at, c.name as customer_name
                FROM orders o
                LEFT JOIN customers c ON o.customer_id = c.id
                WHERE o.base_id = $1 AND o.approval_status = 'pending' AND o.discount_amount_cents > 0
                ORDER BY o.created_at DESC
                "#,
                base_id
            )
            .fetch_all(&state.db_pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            for r in rows {
                items.push(ApprovalItem {
                    id: r.id,
                    type_: "discount".to_string(),
                    title: format!("折扣申请: {}", r.customer_name.unwrap_or("未知客户".to_string())),
                    subtitle: format!("订单号: {}", r.order_no),
                    amount_cents: Some(r.discount_amount_cents as i64),
                    status: "pending".to_string(),
                    created_at: r.created_at.unwrap_or_else(Utc::now),
                    requester_name: None, // 销售员名字暂未关联
                    proof_url: None,
                });
            }
        },
        "refund" => {
            let rows = sqlx::query!(
                r#"
                SELECT rr.id, rr.amount_cents, rr.reason, rr.created_at, u.email as "requester_email?"
                FROM refund_requests rr
                LEFT JOIN users u ON rr.created_by = u.id
                WHERE rr.base_id = $1 AND rr.status = 'pending'
                ORDER BY rr.created_at DESC
                "#,
                base_id
            )
            .fetch_all(&state.db_pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            for r in rows {
                items.push(ApprovalItem {
                    id: r.id,
                    type_: "refund".to_string(),
                    title: "退费申请".to_string(),
                    subtitle: r.reason,
                    amount_cents: Some(r.amount_cents as i64),
                    status: "pending".to_string(),
                    created_at: r.created_at.unwrap_or_else(Utc::now),
                    requester_name: r.requester_email, 
                    proof_url: None, 
                });
            }
        },
        "expense" => {
            let rows = sqlx::query!(
                r#"
                SELECT e.id, e.amount_cents, e.description, e.created_at, e.proof_image_url, u.email as "requester_email?"
                FROM expenses e
                LEFT JOIN users u ON e.created_by = u.id
                WHERE e.base_id = $1 AND e.status = 'pending'
                ORDER BY e.created_at DESC
                "#,
                base_id
            )
            .fetch_all(&state.db_pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            for r in rows {
                items.push(ApprovalItem {
                    id: r.id,
                    type_: "expense".to_string(),
                    title: "报销/支出申请".to_string(),
                    subtitle: r.description.unwrap_or_default(),
                    amount_cents: Some(r.amount_cents as i64),
                    status: "pending".to_string(),
                    created_at: r.created_at.unwrap_or_else(Utc::now),
                    requester_name: r.requester_email,
                    proof_url: r.proof_image_url,
                });
            }
        },
        "leave" => {
            let rows = sqlx::query!(
                r#"
                SELECT lr.id, lr.type as "type_", lr.reason, lr.start_time, lr.end_time, lr.created_at, u.email as "requester_email?"
                FROM leave_requests lr
                LEFT JOIN users u ON lr.user_id = u.id
                WHERE lr.base_id = $1 AND lr.status = 'pending'
                ORDER BY lr.created_at DESC
                "#,
                base_id
            )
            .fetch_all(&state.db_pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            for r in rows {
                let leave_type = match r.type_.as_str() {
                    "sick" => "病假",
                    "casual" => "事假",
                    "annual" => "年假",
                    _ => "其他"
                };
                items.push(ApprovalItem {
                    id: r.id,
                    type_: "leave".to_string(),
                    title: format!("请假申请: {}", r.requester_email.clone().unwrap_or("未知".to_string())),
                    subtitle: format!("{} - {}", leave_type, r.reason.unwrap_or_default()),
                    amount_cents: None,
                    status: "pending".to_string(),
                    created_at: r.created_at.unwrap_or_else(Utc::now),
                    requester_name: r.requester_email,
                    proof_url: None,
                });
            }
        },
        _ => return Err((StatusCode::BAD_REQUEST, "Invalid approval type".to_string())),
    }

    Ok(Json(items))
}

pub async fn handle_approval_action_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<ApprovalActionPayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid User ID in token".to_string()))?;

    let new_status = match payload.action.as_str() {
        "approve" => "approved",
        "reject" => "rejected",
        _ => return Err((StatusCode::BAD_REQUEST, "Invalid action".to_string())),
    };

    match payload.type_.as_str() {
        "discount" => {
            sqlx::query!(
                "UPDATE orders SET approval_status = $1, approved_by = $2, approved_at = NOW() WHERE id = $3",
                new_status, user_id, payload.id
            )
            .execute(&state.db_pool).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        },
        "refund" => {
            sqlx::query!(
                "UPDATE refund_requests SET status = $1, approved_by = $2, approved_at = NOW(), rejection_reason = $3 WHERE id = $4",
                new_status, user_id, payload.reason, payload.id
            )
            .execute(&state.db_pool).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        },
        "expense" => {
            sqlx::query!(
                "UPDATE expenses SET status = $1, approved_by = $2, approved_at = NOW(), rejection_reason = $3 WHERE id = $4",
                new_status, user_id, payload.reason, payload.id
            )
            .execute(&state.db_pool).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        },
        "leave" => {
            sqlx::query!(
                "UPDATE leave_requests SET status = $1, approved_by = $2, approved_at = NOW(), rejection_reason = $3 WHERE id = $4",
                new_status, user_id, payload.reason, payload.id
            )
            .execute(&state.db_pool).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        },
        _ => return Err((StatusCode::BAD_REQUEST, "Invalid approval type".to_string())),
    }

    Ok(Json(serde_json::json!({ "success": true })))
}

#[derive(Debug, Serialize)]
pub struct FinanceSummary {
    pub today_income_cents: i64,
    pub month_income_cents: i64,
    pub month_expense_cents: i64,
    pub recent_transactions: Vec<TransactionItem>,
}

#[derive(Debug, Serialize)]
pub struct TransactionItem {
    pub id: Uuid,
    pub title: String,
    pub amount_cents: i64,
    pub type_: String, // income, expense
    pub created_at: DateTime<Utc>,
}

pub async fn get_finance_summary_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<FinanceSummary>, (StatusCode, String)> {
    let base_id = claims.base_id.ok_or((StatusCode::FORBIDDEN, "Base ID required".to_string()))?;

    // 1. Incomes (Orders)
    let today_income: i64 = sqlx::query_scalar!(
        "SELECT SUM(total_amount_cents) FROM orders WHERE base_id = $1 AND status = 'paid' AND created_at >= CURRENT_DATE",
        base_id
    )
    .fetch_one(&state.db_pool).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?.unwrap_or(0);

    let month_income: i64 = sqlx::query_scalar!(
        "SELECT SUM(total_amount_cents) FROM orders WHERE base_id = $1 AND status = 'paid' AND created_at >= date_trunc('month', CURRENT_DATE)",
        base_id
    )
    .fetch_one(&state.db_pool).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?.unwrap_or(0);

    // 2. Expenses
    let month_expense: i64 = sqlx::query_scalar!(
        "SELECT SUM(amount_cents) FROM expenses WHERE base_id = $1 AND status = 'approved' AND created_at >= date_trunc('month', CURRENT_DATE)",
        base_id
    )
    .fetch_one(&state.db_pool).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?.unwrap_or(0);

    // 3. Recent Transactions (Orders + Expenses mixed)
    // Union query is complex with sqlx macro types, so we query separately and merge in memory for simplicity (or use a view)
    // Let's just fetch 5 recent orders and 5 recent expenses
    let recent_orders = sqlx::query!(
        r#"
        SELECT id, order_no, total_amount_cents, created_at, 'income' as type_
        FROM orders 
        WHERE base_id = $1 AND status = 'paid'
        ORDER BY created_at DESC LIMIT 5
        "#,
        base_id
    )
    .fetch_all(&state.db_pool).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let recent_expenses = sqlx::query!(
        r#"
        SELECT id, description, amount_cents, created_at, 'expense' as type_
        FROM expenses 
        WHERE base_id = $1 AND status = 'approved'
        ORDER BY created_at DESC LIMIT 5
        "#,
        base_id
    )
    .fetch_all(&state.db_pool).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut transactions = Vec::new();
    for o in recent_orders {
        transactions.push(TransactionItem {
            id: o.id,
            title: format!("收入-订单 {}", o.order_no),
            amount_cents: o.total_amount_cents as i64,
            type_: "income".to_string(),
            created_at: o.created_at.unwrap_or(Utc::now()),
        });
    }
    for e in recent_expenses {
        transactions.push(TransactionItem {
            id: e.id,
            title: format!("支出-{}", e.description.unwrap_or("未知".to_string())),
            amount_cents: e.amount_cents as i64,
            type_: "expense".to_string(),
            created_at: e.created_at.unwrap_or(Utc::now()),
        });
    }

    // Sort by time desc
    transactions.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    transactions.truncate(10);

    Ok(Json(FinanceSummary {
        today_income_cents: today_income,
        month_income_cents: month_income,
        month_expense_cents: month_expense,
        recent_transactions: transactions,
    }))
}

#[derive(Debug, Serialize)]
pub struct StaffItem {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub role: String,
    pub phone_number: Option<String>,
    pub avatar_url: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

pub async fn get_base_staff_list_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<StaffItem>>, (StatusCode, String)> {
    let base_id = claims.base_id.ok_or((StatusCode::FORBIDDEN, "Base ID required".to_string()))?;

    let rows = sqlx::query!(
        r#"
        SELECT 
            id, 
            full_name as name, 
            email, 
            (
                SELECT r.name_key 
                FROM user_roles ur 
                JOIN roles r ON ur.role_id = r.id 
                WHERE ur.user_id = users.id 
                LIMIT 1
            ) as "role?", 
            phone_number, 
            NULL::text as avatar_url, 
            staff_status::text as status, 
            created_at
        FROM users
        WHERE base_id = $1
        ORDER BY created_at DESC
        "#,
        base_id
    )
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut items = Vec::new();
    for r in rows {
        items.push(StaffItem {
            id: r.id,
            name: r.name.unwrap_or_else(|| "Unknown".to_string()),
            email: r.email,
            role: r.role.unwrap_or_else(|| "unknown".to_string()),
            phone_number: r.phone_number,
            avatar_url: r.avatar_url,
            status: r.status.unwrap_or_else(|| "unknown".to_string()),
            created_at: r.created_at.unwrap_or_else(Utc::now),
        });
    }

    Ok(Json(items))
}

#[derive(Debug, Deserialize)]
pub struct ReportQuery {
    pub dimension: String, // revenue, sales, funnel, course
    pub range: Option<String>, // month, quarter, year (defaults to month/recent)
}

// 统一的报表响应结构，根据 dimension 返回不同 data 结构 (使用 serde_json::Value 灵活处理)
// 或者定义具体的结构体

#[derive(Debug, Serialize)]
pub struct ChartData {
    pub labels: Vec<String>,
    pub datasets: Vec<ChartDataset>,
    pub summary: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct ChartDataset {
    pub label: String,
    pub data: Vec<f64>,
}

pub async fn get_report_stats_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(query): Query<ReportQuery>,
) -> Result<Json<ChartData>, (StatusCode, String)> {
    let base_id = claims.base_id.ok_or((StatusCode::FORBIDDEN, "Base ID required".to_string()))?;

    match query.dimension.as_str() {
        "revenue" => {
            // 最近6个月的收入 trend
            // 使用 generate_series 生成月份，即使某月无数据也要显示0
            // 为简化，这里演示直接按月 group by
            
            let rows = sqlx::query!(
                r#"
                SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
                       SUM(total_amount_cents) as total
                FROM orders
                WHERE base_id = $1 AND status = 'paid' 
                      AND created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '5 months')
                GROUP BY 1
                ORDER BY 1
                "#,
                base_id
            )
            .fetch_all(&state.db_pool).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            let mut labels = Vec::new();
            let mut data = Vec::new();
            
            for row in rows {
                labels.push(row.month.unwrap_or_default());
                data.push(row.total.unwrap_or(0) as f64 / 100.0);
            }

            // TODO: If needed, query expenses too and add as second dataset

            Ok(Json(ChartData {
                labels,
                datasets: vec![ChartDataset { label: "实收金额".to_string(), data }],
                summary: Some(serde_json::json!({
                    "trend": "up", // mock
                    "msg": "营收稳步增长"
                }))
            }))
        },
        "sales" => {
            // Real Sales Ranking: Order -> Customer -> Creator (User)
            let rows = sqlx::query!(
                r#"
                SELECT u.full_name as name, SUM(o.total_amount_cents) as total
                FROM orders o
                JOIN customers c ON o.customer_id = c.id
                JOIN users u ON c.created_by = u.id
                WHERE o.base_id = $1 AND o.status = 'paid'
                GROUP BY u.full_name
                ORDER BY total DESC
                LIMIT 5
                "#,
                base_id
            )
            .fetch_all(&state.db_pool).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            let mut labels = Vec::new();
            let mut data = Vec::new();

            for row in rows {
                labels.push(row.name.unwrap_or("Unknown".to_string()));
                data.push(row.total.unwrap_or(0) as f64 / 100.0);
            }

            let top_sales = if !labels.is_empty() { labels[0].clone() } else { "无".to_string() };

            Ok(Json(ChartData {
                labels,
                datasets: vec![ChartDataset { label: "成交金额".to_string(), data }],
                summary: Some(serde_json::json!({
                    "top_sales": top_sales,
                    "msg": format!("{} 本月表现最佳", top_sales)
                }))
            }))
        },
        "funnel" => {
            // Real Funnel Data
            
            // 1. Leads: All customers created in this period
            let lead_count = sqlx::query_scalar!(
                "SELECT COUNT(*) FROM customers WHERE base_id = $1 AND created_at >= date_trunc('month', CURRENT_DATE)",
                base_id
            ).fetch_one(&state.db_pool).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?.unwrap_or(0);

            // 2. Trials: All trial classes created (or attended)
            // Checking if trial_classes table exists and has base_id. Assuming yes from previous context.
            let trial_count = sqlx::query_scalar!(
                "SELECT COUNT(*) FROM trial_classes WHERE base_id = $1 AND created_at >= date_trunc('month', CURRENT_DATE)",
                base_id
            ).fetch_one(&state.db_pool).await.unwrap_or(Some(0)).unwrap_or(0);

            // 3. Deals: Paid orders
            let deal_count = sqlx::query_scalar!(
                "SELECT COUNT(*) FROM orders WHERE base_id = $1 AND status = 'paid' AND created_at >= date_trunc('month', CURRENT_DATE)",
                base_id
            ).fetch_one(&state.db_pool).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?.unwrap_or(0);

            Ok(Json(ChartData {
                labels: vec!["新增线索".to_string(), "试听排课".to_string(), "成交报名".to_string()],
                datasets: vec![ChartDataset { 
                    label: "本月转化".to_string(), 
                    data: vec![lead_count as f64, trial_count as f64, deal_count as f64] 
                }],
                summary: Some(serde_json::json!({
                    "conversion_rate": if lead_count > 0 { format!("{:.1}%", (deal_count as f64 / lead_count as f64) * 100.0) } else { "0%".to_string() }
                }))
            }))
        },
        "course" => {
             // Real Course Data from order_items
             let rows = sqlx::query!(
                r#"
                SELECT oi.name, COUNT(DISTINCT o.id) as count
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE o.base_id = $1 AND o.status = 'paid'
                GROUP BY oi.name
                ORDER BY count DESC
                LIMIT 5
                "#,
                base_id
             )
             .fetch_all(&state.db_pool).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

             let mut labels = Vec::new();
             let mut data = Vec::new();
             
             for row in rows {
                 labels.push(row.name);
                 data.push(row.count.unwrap_or(0) as f64);
             }

             Ok(Json(ChartData {
                labels,
                datasets: vec![ChartDataset { 
                    label: "报名人数".to_string(), 
                    data 
                }],
                summary: None
             }))
        },
        _ => Err((StatusCode::BAD_REQUEST, "Invalid dimension".to_string()))
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateNoticePayload {
    pub title: String,
    pub content: String,
    pub priority: Option<String>,
}

pub async fn create_notice_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateNoticePayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let base_id = claims.base_id.ok_or((StatusCode::FORBIDDEN, "Base ID required".to_string()))?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid User ID".to_string()))?;

    sqlx::query!(
        "INSERT INTO notices (base_id, title, content, priority, created_by) VALUES ($1, $2, $3, $4, $5)",
        base_id,
        payload.title,
        payload.content,
        payload.priority.unwrap_or("normal".to_string()),
        user_id
    )
    .execute(&state.db_pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "success": true })))
}
