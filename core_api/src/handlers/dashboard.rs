/*
 * src/handlers/dashboard.rs
 * 职责: 基地老板决策看板 API
 */

use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use serde::Serialize;
use super::AppState;
use crate::models::Claims;
use chrono::{Datelike, Utc};

// ==========================================
// 1. Data Models
// ==========================================

#[derive(Serialize)]
pub struct DashboardOverview {
    pub timestamp: chrono::DateTime<Utc>,
    pub base_id: uuid::Uuid,
    pub base_name: String,
    pub metrics: DashboardMetrics,
}

#[derive(Serialize)]
pub struct DashboardMetrics {
    pub cash_flow: CashFlowMetric,
    pub today_revenue: TodayRevenueMetric,
    pub students: StudentsMetric,
    pub recruitment: RecruitmentMetric,
    pub revenue_progress: RevenueProgressMetric,
    pub profitability: ProfitabilityMetric,
    pub tob_status: ToBStatusMetric,
    pub alerts: AlertsMetric,
    pub trends: TrendMetric,
    pub customer_composition: Vec<CompositionMetric>,
    pub upcoming_events: Vec<EventMetric>,
    pub todo_list: Vec<TodoMetric>,
}

#[derive(Serialize)]
pub struct TrendMetric {
    pub labels: Vec<String>,
    pub revenue: Vec<i32>,
    pub students: Vec<i64>,
}

#[derive(Serialize)]
pub struct CompositionMetric {
    pub name: String,
    pub value: i64,
    pub color: String,
}

#[derive(Serialize)]
pub struct EventMetric {
    pub date: String,
    pub customer_name: String,
    pub type_name: String,
    pub headcount: i64,
}

#[derive(Serialize)]
pub struct TodoMetric {
    pub id: String,
    pub title: String,
    pub tag: String,
    pub tag_color: String,
    pub date: String,
}


// 指标1: 现金流健康度
#[derive(Serialize)]
pub struct CashFlowMetric {
    pub cash_on_hand: i32,           // 账上现金（分）
    pub accounts_receivable: i32,    // 应收账款
    pub overdue_count: i64,          // 逾期人数
    pub available_funds: i32,        // 可用资金
    pub runway_months: f32,          // 资金可用月数
    pub status: String,              // healthy/warning/critical
}

// 指标2: 今日收款
#[derive(Serialize)]
pub struct TodayRevenueMetric {
    pub total: i32,
    pub toc: i32,
    pub tob: i32,
    pub order_count: i64,
}

// 指标3: 学员数
#[derive(Serialize)]
pub struct StudentsMetric {
    pub active_students: i64,
    pub capacity: i32,
    pub utilization_rate: f32,
    pub this_month_new: i64,
    pub this_month_churned: i64,
    pub net_growth: i64,
    pub trend: String, // up/stable/down
}

// 指标4: 招生效率
#[derive(Serialize)]
pub struct RecruitmentMetric {
    pub leads_count: i64,
    pub trial_scheduled: i64,
    pub trial_completed: i64,
    pub trial_converted: i64,
    pub signed_count: i64,
    pub trial_conversion_rate: f32,
    pub overall_conversion_rate: f32,
    pub cac: i32,              // 获客成本
    pub ltv: i32,              // 客户生命周期价值
    pub ltv_cac_ratio: f32,
    pub status: String,        // healthy/warning/poor
}

// 指标5: 本月营收进度
#[derive(Serialize)]
pub struct RevenueProgressMetric {
    pub target: i32,
    pub actual: i32,
    pub completion_rate: f32,
    pub days_passed: i32,
    pub days_total: i32,
    pub expected_pace: i32,
    pub pace_status: String,  // ahead/on_track/behind
    pub projection: i32,      // 月底预测
}

// 指标6: 利润健康度
#[derive(Serialize)]
pub struct ProfitabilityMetric {
    pub total_revenue: i32,
    pub toc_revenue: i32,
    pub tob_revenue: i32,
    pub total_expense: i32,
    pub gross_profit: i32,
    pub gross_margin: f32,
    pub tob_ratio: f32,
    pub tob_target: f32,
    pub profit_status: String, // healthy/warning/poor
}

// 指标7: ToB订单状态
#[derive(Serialize)]
pub struct ToBStatusMetric {
    pub tomorrow_events_count: i64,
    pub in_progress_count: i64,
    pub in_progress_amount: i32,
    pub overdue_count: i64,
}

// 指标8: 异常预警
#[derive(Serialize)]
pub struct AlertsMetric {
    pub critical: Vec<Alert>,
    pub warning: Vec<Alert>,
    pub info: Vec<Alert>,
}

#[derive(Serialize)]
pub struct Alert {
    pub alert_type: String,
    pub severity: String,
    pub count: Option<i64>,
    pub amount: Option<i32>,
    pub value: Option<f32>,
    pub message: String,
}

// ==========================================
// 2. API Handlers
// ==========================================

// GET /api/v1/base/dashboard/overview
pub async fn get_dashboard_overview_handler(
   State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<DashboardOverview>, StatusCode> {
    // 检查权限：必须是基地角色
    if !claims.roles.iter().any(|r| r.starts_with("role.base.")) {
        return Err(StatusCode::FORBIDDEN);
    }

    let base_id = match claims.base_id {
        Some(id) => id,
        None => return Err(StatusCode::FORBIDDEN),
    };

    // 获取基地名称
    let base_name = sqlx::query_scalar::<_, String>(
        "SELECT name FROM bases WHERE id = $1"
    )
    .bind(base_id)
    .fetch_one(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 获取各项指标
    let cash_flow = get_cash_flow_metric(&state, base_id).await?;
    let today_revenue = get_today_revenue_metric(&state, base_id).await?;
    let students = get_students_metric(&state, base_id).await?;
    let recruitment = get_recruitment_metric(&state, base_id).await?;
    let revenue_progress = get_revenue_progress_metric(&state, base_id).await?;
    let profitability = get_profitability_metric(&state, base_id).await?;
    let tob_status = get_tob_status_metric(&state, base_id).await?;
    let alerts = get_alerts_metric(&state, base_id, &cash_flow, &profitability).await?;
    
    // New Metrics
    let trends = get_trends_metric(&state, base_id).await?;
    let customer_composition = get_composition_metric(&state, base_id).await?;
    let upcoming_events = get_upcoming_events_metric(&state, base_id).await?;
    let todo_list = get_todo_list_metric(&state, base_id).await?;

    Ok(Json(DashboardOverview {
        timestamp: Utc::now(),
        base_id,
        base_name,
        metrics: DashboardMetrics {
            cash_flow,
            today_revenue,
            students,
            recruitment,
            revenue_progress,
            profitability,
            tob_status,
            alerts,
            trends,
            customer_composition,
            upcoming_events,
            todo_list,
        },
    }))
}

// ==========================================
// 3. 指标计算函数
// ==========================================

// 指标1: 现金流健康度
async fn get_cash_flow_metric(
    state: &AppState,
    base_id: uuid::Uuid,
) -> Result<CashFlowMetric, StatusCode> {
    // 账上现金（简化版：从 finance_accounts 获取）
    let cash_on_hand: i32 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(balance_cents), 0) FROM finance_accounts 
         WHERE base_id = $1 AND account_type = 'cash' AND is_active = true"
    )
    .bind(base_id)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(0);

    // 应收账款（待收款订单总额）
    let receivable_result = sqlx::query!(
        r#"
        SELECT 
            COUNT(*) as "count!",
            COALESCE(SUM(total_amount_cents - paid_amount_cents), 0) as "amount!"
        FROM orders
        WHERE base_id = $1 
          AND status IN ('pending', 'partial_paid')
          AND (due_date < CURRENT_DATE - INTERVAL '7 days' OR due_date IS NULL)
        "#,
        base_id
    )
    .fetch_one(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let accounts_receivable = receivable_result.amount as i32;
    let overdue_count = receivable_result.count;

    // 可用资金 = 现金 - 预留金额（暂时简化为直接使用现金）
    let available_funds = cash_on_hand;

    // 月均支出（最近3个月平均）
    let avg_monthly_expense: Option<i32> = sqlx::query_scalar(
        r#"
        SELECT AVG(monthly_expense)::INT FROM (
            SELECT SUM(amount_cents) as monthly_expense
            FROM expenses
            WHERE base_id = $1 
              AND expense_date >= CURRENT_DATE - INTERVAL '3 months'
            GROUP BY EXTRACT(MONTH FROM expense_date)
        ) as monthly_avg
        "#
    )
    .bind(base_id)
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .flatten();

    // 资金可用月数
    let runway_months = if let Some(expense) = avg_monthly_expense {
        if expense > 0 {
            available_funds as f32 / expense as f32
        } else {
            999.0 // 没有支出，理论上无限
        }
    } else {
        999.0 // 没有历史数据
    };

    // 状态判断
    let status = if runway_months < 1.0 {
        "critical".to_string()
    } else if runway_months < 2.0 {
        "warning".to_string()
    } else {
        "healthy".to_string()
    };

    Ok(CashFlowMetric {
        cash_on_hand,
        accounts_receivable,
        overdue_count,
        available_funds,
        runway_months,
        status,
    })
}

// 指标2: 今日收款
async fn get_today_revenue_metric(
    state: &AppState,
    base_id: uuid::Uuid,
) -> Result<TodayRevenueMetric, StatusCode> {
    let result = sqlx::query!(
        r#"
        SELECT 
            COUNT(*) as "count!",
            COALESCE(SUM(CASE WHEN type = 'b2c' THEN paid_amount_cents ELSE 0 END), 0) as "toc!",
            COALESCE(SUM(CASE WHEN type = 'b2b' THEN paid_amount_cents ELSE 0 END), 0) as "tob!",
            COALESCE(SUM(paid_amount_cents), 0) as "total!"
        FROM orders
        WHERE base_id = $1 
          AND (DATE(paid_date) = CURRENT_DATE 
               OR (status = 'paid' AND DATE(updated_at) = CURRENT_DATE))
        "#,
        base_id
    )
    .fetch_one(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(TodayRevenueMetric {
        total: result.total as i32,
        toc: result.toc as i32,
        tob: result.tob as i32,
        order_count: result.count,
    })
}

// 指标3: 学员数
async fn get_students_metric(
    state: &AppState,
    base_id: uuid::Uuid,
) -> Result<StudentsMetric, StatusCode> {
    // 在校学员（通过 customer_id 关联到 base_id）
    let active_students: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(DISTINCT p.id)
        FROM participants p
        INNER JOIN customers c ON p.customer_id = c.id
        WHERE c.base_id = $1 AND p.is_active = true
        "#
    )
    .bind(base_id)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(0);

    // 容量（暂时硬编码为500，后续可从 base_settings 获取）
    let capacity = 500;

    // 本月新增
    let this_month_new: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(DISTINCT p.id)
        FROM participants p
        INNER JOIN customers c ON p.customer_id = c.id
        WHERE c.base_id = $1 
          AND p.created_at >= DATE_TRUNC('month', CURRENT_DATE)
          AND p.is_active = true
        "#
    )
    .bind(base_id)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(0);

    // 本月流失
    let this_month_churned: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM participant_status_changes psc
        WHERE psc.base_id = $1
          AND psc.changed_to = 'inactive'
          AND psc.changed_at >= DATE_TRUNC('month', CURRENT_DATE)
        "#
    )
    .bind(base_id)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(0);

    let net_growth = this_month_new as i64 - this_month_churned as i64;
    let trend = if net_growth > 0 {
        "up"
    } else if net_growth < 0 {
        "down"
    } else {
        "stable"
    };

    Ok(StudentsMetric {
        active_students,
        capacity,
        utilization_rate: active_students as f32 / capacity as f32,
        this_month_new,
        this_month_churned,
        net_growth,
        trend: trend.to_string(),
    })
}

// 指标4: 招生效率（简化版）
async fn get_recruitment_metric(
    state: &AppState,
    base_id: uuid::Uuid,
) -> Result<RecruitmentMetric, StatusCode> {
    // 本月新线索数
    let leads_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM leads 
         WHERE base_id = $1 
           AND created_at >= DATE_TRUNC('month', CURRENT_DATE)"
    )
    .bind(base_id)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(0);

    // 试听课统计
    let trial_stats = sqlx::query!(
        r#"
        SELECT 
            COUNT(*) as "total!",
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as "completed!"
        FROM trial_classes
        WHERE base_id = $1 
          AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
        "#,
        base_id
    )
    .fetch_one(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let trial_scheduled = trial_stats.total;
    let trial_completed = trial_stats.completed;

    // 转化数（本月新增客户）
    let signed_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM customers 
         WHERE base_id = $1 
           AND created_at >= DATE_TRUNC('month', CURRENT_DATE)"
    )
    .bind(base_id)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(0);

    // 转化率
    let trial_conversion_rate = if trial_completed > 0 {
        signed_count as f32 / trial_completed as f32
    } else {
        0.0
    };

    let overall_conversion_rate = if leads_count > 0 {
        signed_count as f32 / leads_count as f32
    } else {
        0.0
    };

    // 获客成本和LTV（简化版）
    let cac = 800; // 硬编码，后续从营销支出计算
    let ltv = 3500; // 硬编码，后续从订单数据计算
    let ltv_cac_ratio = ltv as f32 / cac as f32;

    let status = if ltv_cac_ratio > 3.0 {
        "healthy"
    } else if ltv_cac_ratio > 1.5 {
        "warning"
    } else {
        "poor"
    };

    Ok(RecruitmentMetric {
        leads_count,
        trial_scheduled,
        trial_completed,
        trial_converted: signed_count,
        signed_count,
        trial_conversion_rate,
        overall_conversion_rate,
        cac,
        ltv,
        ltv_cac_ratio,
        status: status.to_string(),
    })
}

// 指标5: 本月营收进度
async fn get_revenue_progress_metric(
    state: &AppState,
    base_id: uuid::Uuid,
) -> Result<RevenueProgressMetric, StatusCode> {
    // 本月实际营收
    let actual: i32 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(total_amount_cents), 0)
        FROM orders
        WHERE base_id = $1
          AND status IN ('paid', 'partial_paid')
          AND EXTRACT(MONTH FROM paid_date) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(YEAR FROM paid_date) = EXTRACT(YEAR FROM CURRENT_DATE)
        "#
    )
    .bind(base_id)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(0);

    // 目标（从 base_settings 获取，如果没有则使用默认值）
    let target: i32 = sqlx::query_scalar(
        "SELECT monthly_revenue_target_cents FROM base_settings WHERE base_id = $1"
    )
    .bind(base_id)
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .flatten()
    .unwrap_or(30000000); // 默认 ¥300,000

    let now = Utc::now();
    let days_passed = now.day() as i32;
    let days_total = chrono::NaiveDate::from_ymd_opt(
        now.year(),
        now.month(),
        1
    )
    .and_then(|d| d.iter_days().last())
    .map(|d| d.day() as i32)
    .unwrap_or(30);

    let expected_pace = (target as f32 * days_passed as f32 / days_total as f32) as i32;
    let completion_rate = actual as f32 / target as f32;

    let pace_status = if actual >= expected_pace {
        "ahead"
    } else if actual as f32 >= expected_pace as f32 * 0.9 {
        "on_track"
    } else {
        "behind"
    };

    let projection = if days_passed > 0 {
        (actual as f32 / days_passed as f32 * days_total as f32) as i32
    } else {
        0
    };

    Ok(RevenueProgressMetric {
        target,
        actual,
        completion_rate,
        days_passed,
        days_total,
        expected_pace,
        pace_status: pace_status.to_string(),
        projection,
    })
}

// 指标6: 利润健康度
async fn get_profitability_metric(
    state: &AppState,
    base_id: uuid::Uuid,
) -> Result<ProfitabilityMetric, StatusCode> {
    // 收入
    let revenue_result = sqlx::query!(
        r#"
        SELECT 
            COALESCE(SUM(CASE WHEN type = 'b2c' THEN total_amount_cents ELSE 0 END), 0) as "toc!",
            COALESCE(SUM(CASE WHEN type = 'b2b' THEN total_amount_cents ELSE 0 END), 0) as "tob!",
            COALESCE(SUM(total_amount_cents), 0) as "total!"
        FROM orders
        WHERE base_id = $1
          AND status IN ('paid', 'partial_paid')
          AND EXTRACT(MONTH FROM paid_date) = EXTRACT(MONTH FROM CURRENT_DATE)
        "#,
        base_id
    )
    .fetch_one(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let total_revenue = revenue_result.total as i32;
    let toc_revenue = revenue_result.toc as i32;
    let tob_revenue = revenue_result.tob as i32;

    // 支出
    let total_expense: i32 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(amount_cents), 0)
        FROM expenses
        WHERE base_id = $1
          AND EXTRACT(MONTH FROM expense_date) = EXTRACT(MONTH FROM CURRENT_DATE)
        "#
    )
    .bind(base_id)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(0);

    let gross_profit = total_revenue - total_expense;
    let gross_margin = if total_revenue > 0 {
        gross_profit as f32 / total_revenue as f32
    } else {
        0.0
    };

    let tob_ratio = if total_revenue > 0 {
        tob_revenue as f32 / total_revenue as f32
    } else {
        0.0
    };

    let tob_target = 0.50; // 50%

    let profit_status = if gross_margin >= 0.50 {
        "healthy"
    } else if gross_margin >= 0.30 {
        "warning"
    } else {
        "poor"
    };

    Ok(ProfitabilityMetric {
        total_revenue,
        toc_revenue,
        tob_revenue,
        total_expense,
        gross_profit,
        gross_margin,
        tob_ratio,
        tob_target,
        profit_status: profit_status.to_string(),
    })
}

// 指标7: ToB订单状态
async fn get_tob_status_metric(
    state: &AppState,
    base_id: uuid::Uuid,
) -> Result<ToBStatusMetric, StatusCode> {
    // 明日活动数量
    let tomorrow_events_count: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM orders
        WHERE base_id = $1
          AND type = 'b2b'
          AND event_date = CURRENT_DATE + 1
          AND status NOT IN ('cancelled', 'completed')
        "#
    )
    .bind(base_id)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(0);

    // 执行中订单
    let in_progress_result = sqlx::query!(
        r#"
        SELECT 
            COUNT(*) as "count!",
            COALESCE(SUM(total_amount_cents), 0) as "amount!"
        FROM orders
        WHERE base_id = $1
          AND type = 'b2b'
          AND status IN ('pending', 'partial_paid')
        "#,
        base_id
    )
    .fetch_one(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 延期订单
    let overdue_count: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM orders
        WHERE base_id = $1
          AND type = 'b2b'
          AND status NOT IN ('completed', 'cancelled')
          AND event_date < CURRENT_DATE
        "#
    )
    .bind(base_id)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(0);

    Ok(ToBStatusMetric {
        tomorrow_events_count,
        in_progress_count: in_progress_result.count,
        in_progress_amount: in_progress_result.amount as i32,
        overdue_count,
    })
}

// 指标8: 异常预警
async fn get_alerts_metric(
    _state: &AppState,
    _base_id: uuid::Uuid,
    cash_flow: &CashFlowMetric,
    profitability: &ProfitabilityMetric,
) -> Result<AlertsMetric, StatusCode> {
    let mut critical = Vec::new();
    let mut warning = Vec::new();
    let info = Vec::new();

    // Critical: 应收款逾期
    if cash_flow.overdue_count > 0 {
        critical.push(Alert {
            alert_type: "overdue_payment".to_string(),
            severity: "critical".to_string(),
            count: Some(cash_flow.overdue_count),
            amount: Some(cash_flow.accounts_receivable),
            value: None,
            message: format!("应收款逾期7天以上：{}人", cash_flow.overdue_count),
        });
    }

    // Critical: 现金流不足
    if cash_flow.runway_months < 1.0 {
        critical.push(Alert {
            alert_type: "low_cash".to_string(),
            severity: "critical".to_string(),
            count: None,
            amount: Some(cash_flow.available_funds),
            value: Some(cash_flow.runway_months),
            message: format!("现金仅够 {:.1} 个月", cash_flow.runway_months),
        });
    }

    // Warning: 利润率偏低
    if profitability.gross_margin < 0.30 {
        warning.push(Alert {
            alert_type: "low_profit_margin".to_string(),
            severity: "warning".to_string(),
            count: None,
            amount: None,
            value: Some(profitability.gross_margin),
            message: format!("利润率仅 {:.1}%", profitability.gross_margin * 100.0),
        });
    }

    Ok(AlertsMetric {
        critical,
        warning,
        info,
    })
}

// ==========================================
// 4. 新增 Web 端专用的图表与列表指标
// ==========================================

async fn get_trends_metric(state: &AppState, base_id: uuid::Uuid) -> Result<TrendMetric, StatusCode> {
    // 获取最近7天数据
    let rows = sqlx::query!(
        r#"
        SELECT 
            TO_CHAR(curr_date, 'MM-DD') as "day!",
            COALESCE(SUM(o.total_amount_cents), 0) as "revenue!",
            COUNT(o.id) as "count!"
        FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day') as curr_date
        LEFT JOIN orders o ON DATE(o.created_at) = DATE(curr_date) AND o.base_id = $1 AND o.status = 'paid'
        GROUP BY curr_date
        ORDER BY curr_date
        "#,
        base_id
    )
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Trend query failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let mut labels = Vec::new();
    let mut revenue = Vec::new();
    let mut students = Vec::new();

    for r in rows {
        labels.push(r.day);
        revenue.push(r.revenue as i32);
        students.push(r.count); 
    }

    Ok(TrendMetric { labels, revenue, students })
}

async fn get_composition_metric(state: &AppState, base_id: uuid::Uuid) -> Result<Vec<CompositionMetric>, StatusCode> {
    let rows = sqlx::query!(
        r#"
        SELECT type::TEXT as "type_!", COUNT(*) as "count!"
        FROM orders
        WHERE base_id = $1 AND status = 'paid'
        GROUP BY type
        "#,
        base_id
    )
    .fetch_all(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut res = Vec::new();
    let colors = vec!["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"]; 
    
    for (i, r) in rows.iter().enumerate() {
        res.push(CompositionMetric {
            name: match r.type_.as_str() {
                "b2c" => "个人学员",
                "b2b" => "企业团建",
                "b2g" => "政府合作",
                _ => "其他"
            }.to_string(),
            value: r.count,
            color: colors[i % colors.len()].to_string(),
        });
    }
    
    if res.is_empty() {
        res.push(CompositionMetric { name: "暂无数据".to_string(), value: 1, color: "#e5e7eb".to_string() });
    }

    Ok(res)
}

async fn get_upcoming_events_metric(state: &AppState, base_id: uuid::Uuid) -> Result<Vec<EventMetric>, StatusCode> {
    let rows = sqlx::query!(
        r#"
        SELECT 
            TO_CHAR(event_date, 'MM-DD') as "date!",
            contact_name as "customer_name!",
            type::TEXT as "type_!",
            COALESCE(expected_attendees, 0) as "headcount!"
        FROM orders
        WHERE base_id = $1 AND event_date >= CURRENT_DATE AND type IN ('b2b', 'b2g')
        ORDER BY event_date ASC
        LIMIT 5
        "#,
        base_id
    )
    .fetch_all(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut events = Vec::new();
    for r in rows {
        events.push(EventMetric {
            date: r.date,
            customer_name: r.customer_name,
            type_name: if r.type_ == "b2b" { "企业".to_string() } else { "政府".to_string() },
            headcount: r.headcount as i64,
        });
    }
    Ok(events)
}

async fn get_todo_list_metric(state: &AppState, base_id: uuid::Uuid) -> Result<Vec<TodoMetric>, StatusCode> {
    let mut todos = Vec::new();

    // 1. Pending Approvals
    let pending_approvals = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM expenses WHERE base_id = $1 AND status = 'pending'",
        base_id
    ).fetch_one(&state.db_pool).await.unwrap_or(Some(0)).unwrap_or(0);

    if pending_approvals > 0 {
        todos.push(TodoMetric {
            id: "1".to_string(),
            title: format!("有 {} 笔报销待审批", pending_approvals),
            tag: "待办".to_string(),
            tag_color: "blue".to_string(),
            date: "今日".to_string(),
        });
    }

    // 2. Overdue Payments
    let overdue = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM orders WHERE base_id = $1 AND status = 'pending' AND due_date < CURRENT_DATE",
        base_id
    ).fetch_one(&state.db_pool).await.unwrap_or(Some(0)).unwrap_or(0);

    if overdue > 0 {
        todos.push(TodoMetric {
            id: "2".to_string(),
            title: format!("有 {} 笔款项已逾期", overdue),
            tag: "紧急".to_string(),
            tag_color: "red".to_string(),
            date: "今日".to_string(),
        });
    }

    Ok(todos)
}