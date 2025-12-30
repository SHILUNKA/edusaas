/*
 * src/handlers/dashboard.rs
 * 职责: 看板统计聚合 (HQ + Base V2.0)
 * 修复: 解决 SQL Join、类型推断及日期处理问题
 */

use axum::{extract::State, http::StatusCode, Json};
use chrono::Utc; 
use super::AppState;
use crate::models::{
    Claims, 
    DashboardStats, AdvancedDashboardStats, PendingStaff,
    BaseDashboardFullData, DashboardTodoItem, UpcomingEventItem, CompositionItem
};

// ==========================================
// A. 总部 (HQ) 看板接口 - 【保留原有逻辑】
// ==========================================

pub async fn get_dashboard_stats_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<DashboardStats>, StatusCode> {
    let is_authorized = claims.roles.iter().any(|r| r == "role.hq.admin" || r == "role.hq.operation");
    if !is_authorized { return Err(StatusCode::FORBIDDEN); }

    // 1. Total Bases & Active Bases
    let (total_bases, active_bases): (i64, i64) = sqlx::query_as(
        r#"SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'active') as active
           FROM bases WHERE hq_id = $1"#
    )
    .bind(claims.hq_id)
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or((0, 0));

    // 2. Revenue Stats (Today vs Yesterday)
    // Using filtered aggregation for efficiency
    let (today_revenue, yesterday_rev) = match sqlx::query!(
        r#"
        SELECT
            COALESCE(SUM(paid_amount_cents) FILTER (WHERE date_trunc('day', created_at) = CURRENT_DATE), 0) as today_rev,
            COALESCE(SUM(paid_amount_cents) FILTER (WHERE date_trunc('day', created_at) = CURRENT_DATE - INTERVAL '1 day'), 0) as yesterday_rev
        FROM orders 
        WHERE hq_id = $1 AND status IN ('paid', 'completed')
        "#,
        claims.hq_id
    )
    .fetch_one(&state.db_pool)
    .await 
    {
        Ok(record) => (
            record.today_rev.unwrap_or(0),
            record.yesterday_rev.unwrap_or(0)
        ),
        Err(e) => {
            tracing::error!("Failed to fetch revenue stats: {}", e);
            (0, 0)
        }
    };
    
    // Calculate growth rate
    let revenue_growth_rate = if yesterday_rev > 0 {
        ((today_revenue as f64 - yesterday_rev as f64) / yesterday_rev as f64) * 100.0
    } else if today_revenue > 0 {
        100.0
    } else {
        0.0
    };

    // 3. New Students (Today vs Yesterday)
    let (today_new_students, yesterday_new) = match sqlx::query!(
        r#"
        SELECT
            COUNT(*) FILTER (WHERE date_trunc('day', created_at) = CURRENT_DATE) as today_new,
            COUNT(*) FILTER (WHERE date_trunc('day', created_at) = CURRENT_DATE - INTERVAL '1 day') as yesterday_new
        FROM participants
        WHERE hq_id = $1
        "#,
        claims.hq_id
    )
    .fetch_one(&state.db_pool)
    .await 
    {
        Ok(record) => (
            record.today_new.unwrap_or(0),
            record.yesterday_new.unwrap_or(0)
        ),
        Err(e) => {
            tracing::error!("Failed to fetch student stats: {}", e);
            (0, 0)
        }
    };
    
    let student_growth_rate = if yesterday_new > 0 {
        ((today_new_students as f64 - yesterday_new as f64) / yesterday_new as f64) * 100.0
    } else if today_new_students > 0 {
        100.0
    } else {
        0.0
    };

    // 4. Pending Audits (Mock: Bases pending, Procurements pending)
    // Since we don't have base audit status in DB yet, we sum pending procurements across all bases
    let pending_audit_count = sqlx::query_scalar!(
        r#"SELECT COUNT(*) FROM procurement_orders WHERE hq_id = $1 AND status = 'pending'"#,
        claims.hq_id
    )
    .fetch_one(&state.db_pool)
    .await
    .unwrap_or(Some(0)).unwrap_or(0);

    // 5. 7-Day Revenue Trend
    // Generate series for last 7 days to ensure no missing dates
    let trend_rows = sqlx::query!(
        r#"
        SELECT 
            to_char(d, 'MM-DD') as date_str,
            COALESCE(SUM(o.paid_amount_cents), 0) as daily_rev
        FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day') as d
        LEFT JOIN orders o ON date_trunc('day', o.created_at) = d AND o.hq_id = $1 AND o.status IN ('paid', 'completed')
        GROUP BY d
        ORDER BY d
        "#,
        claims.hq_id
    )
    .fetch_all(&state.db_pool)
    .await
    .unwrap_or(vec![]);

    let mut trend_dates = Vec::new();
    let mut revenue_trend = Vec::new();

    for row in trend_rows {
        trend_dates.push(row.date_str.unwrap_or_default());
        revenue_trend.push(row.daily_rev.unwrap_or(0));
    }

    Ok(Json(DashboardStats {
        total_bases,
        active_bases,
        today_revenue,
        revenue_growth_rate,
        today_new_students,
        student_growth_rate,
        pending_audit_count,
        revenue_trend,
        trend_dates,
    }))
}

pub async fn get_dashboard_advanced_stats_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<AdvancedDashboardStats>, String> {
    if !claims.roles.iter().any(|r| r.starts_with("role.hq")) {
        return Err("Forbidden".into());
    }

    // 1. 本周体验课
    let trial_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM classes c JOIN courses co ON c.course_id = co.id 
         WHERE co.type_ = 'trial' AND c.start_time > NOW() - INTERVAL '7 days'"
    ).fetch_one(&state.db_pool).await.unwrap_or(0);

    // 2. 本周线索转化
    let new_leads: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM customers WHERE created_at > NOW() - INTERVAL '7 days'"
    ).fetch_one(&state.db_pool).await.unwrap_or(1);
    
    let new_members: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM customer_memberships WHERE created_at > NOW() - INTERVAL '7 days'"
    ).fetch_one(&state.db_pool).await.unwrap_or(0);

    let conversion = if new_leads > 0 { (new_members as f64 / new_leads as f64) * 100.0 } else { 0.0 };

    // 3. 活跃度 (Mock)
    let active_rate = 92.5;

    // 4. HR 数据
    let pending_staff: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE staff_status = 'pending'")
        .fetch_one(&state.db_pool).await.unwrap_or(0);
    let total_staff: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE is_active = true")
        .fetch_one(&state.db_pool).await.unwrap_or(0);

    Ok(Json(AdvancedDashboardStats {
        trial_class_count: trial_count,
        new_leads_count: new_leads,
        new_members_count: new_members,
        conversion_rate: conversion,
        active_rate,
        staff_pending_count: pending_staff,
        staff_total_count: total_staff,
    }))
}

pub async fn get_pending_staff_list_handler(
    State(state): State<AppState>,
) -> Result<Json<Vec<PendingStaff>>, String> {
    let list = sqlx::query_as::<_, PendingStaff>(
        r#"
        SELECT u.full_name, '员工' as role_name, u.created_at
        FROM users u WHERE u.staff_status = 'pending'
        ORDER BY u.created_at DESC LIMIT 5
        "#
    ).fetch_all(&state.db_pool).await.unwrap_or(vec![]);
    Ok(Json(list))
}

// ==========================================
// B. 基地 (Base) 看板接口 V2.0 - 【修复版】
// ==========================================

pub async fn get_base_dashboard_overview_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<BaseDashboardFullData>, StatusCode> {
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;

    // 1. 本月接待人数 & 营收 (基于 orders 表的 event_date)
    // 逻辑：统计当月发生的非取消订单
    let current_month_stats = sqlx::query!(
        r#"
        SELECT 
            COALESCE(SUM(expected_attendees), 0) as total_people,
            COALESCE(SUM(total_amount_cents), 0) as total_money
        FROM orders
        WHERE base_id = $1 
          AND status != 'cancelled'
          AND date_trunc('month', event_date) = date_trunc('month', CURRENT_DATE)
        "#,
        base_id
    )
    .fetch_one(&state.db_pool).await.map_err(|e| {
        tracing::error!("Dashboard stats error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let month_headcount = current_month_stats.total_people.unwrap_or(0) as i64;
    let month_revenue = current_month_stats.total_money.unwrap_or(0) as i64;

    // 2. 应收账款 (B2B/B2G 未结款)
    // ★ 修复: type::TEXT 避免枚举类型推断错误
    let pending_payment_amount = sqlx::query_scalar!(
        r#"
        SELECT COALESCE(SUM(total_amount_cents), 0)
        FROM orders
        WHERE base_id = $1 
          AND type::TEXT IN ('b2b', 'b2g')
          AND status IN ('pending', 'partial_paid')
        "#,
        base_id
    ).fetch_one(&state.db_pool).await.unwrap_or(Some(0)).unwrap_or(0) as i64;

    // 3. 客群结构分析
    // ★ 修复: type::TEXT
    let composition_rows = sqlx::query!(
        r#"
        SELECT type::TEXT as "type_", COUNT(*) as count
        FROM orders
        WHERE base_id = $1 AND status != 'cancelled'
        GROUP BY type
        "#,
        base_id
    ).fetch_all(&state.db_pool).await.unwrap_or(vec![]);

    let mut customer_composition = Vec::new();
    for row in composition_rows {
        // row.type_ 现在是 Option<String>
        let (name, color) = match row.type_.as_deref() {
            Some("b2b") => ("企业团建", "#3b82f6"), // Blue
            Some("b2g") => ("党建/政务", "#ef4444"), // Red
            Some("b2c") => ("散客/研学", "#10b981"), // Green
            _ => ("其他", "#9ca3af")
        };
        customer_composition.push(CompositionItem {
            name: name.to_string(),
            value: row.count.unwrap_or(0) as i32,
            color: color.to_string(),
        });
    }

    // 4. 未来 7 天接待预告
    // ★ 修复: JOIN customers 表以获取 customer_name，解决 "column does not exist"
    let upcoming_orders = sqlx::query!(
        r#"
        SELECT 
            c.name as customer_name, 
            o.contact_name, 
            o.type::TEXT as "type_", 
            o.expected_attendees, 
            o.event_date, 
            o.status::TEXT as "status"
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.base_id = $1 
          AND o.status != 'cancelled'
          AND o.event_date >= CURRENT_DATE 
          AND o.event_date <= CURRENT_DATE + INTERVAL '7 days'
        ORDER BY o.event_date ASC
        LIMIT 5
        "#,
        base_id
    ).fetch_all(&state.db_pool).await.unwrap_or(vec![]);

    // ★ 修复: 显式指定闭包参数类型 |d: chrono::NaiveDate|
    let upcoming_events = upcoming_orders.into_iter().map(|o| UpcomingEventItem {
        date: o.event_date.map(|d: chrono::NaiveDate| d.format("%m-%d").to_string()).unwrap_or_default(),
        // 优先显示客户名(B2C/关联客户)，没有则显示联系人(B2B临时)
        customer_name: o.customer_name.or(o.contact_name).unwrap_or("未知客户".into()),
        type_name: match o.type_.as_deref() { Some("b2b")=>"团建", Some("b2g")=>"党建", _=>"参观" }.into(),
        headcount: o.expected_attendees.unwrap_or(0),
        status: o.status.unwrap_or("pending".into()),
    }).collect();

    // 5. 待办事项聚合
    let mut todos = Vec::new();

    // 5.1 待审批采购单
    // ★ 修复: created_at 可能是 Option
    let pending_procurements = sqlx::query!(
        r#"SELECT id, submit_note, created_at FROM procurement_orders WHERE base_id = $1 AND status = 'pending' LIMIT 3"#,
        base_id
    ).fetch_all(&state.db_pool).await.unwrap_or(vec![]);

    for p in pending_procurements {
        let date_str = match p.created_at {
            Some(dt) => dt.format("%Y-%m-%d").to_string(),
            None => "未知日期".to_string()
        };

        todos.push(DashboardTodoItem {
            id: p.id.to_string(),
            title: format!("审批采购: {}", p.submit_note.unwrap_or("无备注".into())),
            tag: "采购".into(),
            tag_color: "blue".into(),
            date: date_str,
        });
    }

    // 5.2 库存预警
    let low_stock_count = sqlx::query_scalar!(
        r#"SELECT COUNT(*) FROM base_inventory WHERE base_id = $1 AND quantity < 10"#,
        base_id
    ).fetch_one(&state.db_pool).await.unwrap_or(Some(0)).unwrap_or(0);

    if low_stock_count > 0 {
        todos.push(DashboardTodoItem {
            id: "stock-alert".into(),
            title: format!("{} 种物资库存不足", low_stock_count),
            tag: "库存".into(),
            tag_color: "red".into(),
            date: Utc::now().format("%Y-%m-%d").to_string(),
        });
    }

    // 6. 趋势 Mock (实际项目建议用 generate_series 生成日期补全数据)
    let trend_labels = vec!["W1".into(), "W2".into(), "W3".into(), "W4".into()];
    let trend_headcount = vec![120, 200, 150, month_headcount]; 
    let trend_revenue = vec![5000000, 8000000, 6000000, month_revenue];

    Ok(Json(BaseDashboardFullData {
        month_revenue,
        revenue_growth: 0.15,
        month_headcount,
        headcount_growth: 0.22,
        pending_payment_amount,
        pending_alerts: low_stock_count + todos.len() as i64,
        trend_labels,
        trend_headcount,
        trend_revenue,
        customer_composition,
        upcoming_events,
        todo_list: todos,
    }))
}