/*
 * src/handlers/hq.rs
 * 职责: 租户级总览 (V16.2 - 增加基地信息查询)
 */
use axum::{extract::State, http::StatusCode, Json};
use super::AppState;
use crate::models::{Claims, ParticipantDetail, DashboardStats, AdvancedDashboardStats, PendingStaff, BaseRankingItem};

// (GET /api/v1/hq/participants)
// (★ V16.3 - 增加 last_class_time)
pub async fn get_all_hq_participants(
    State(state): State<AppState>,
    claims: Claims, 
) -> Result<Json<Vec<ParticipantDetail>>, StatusCode> {
    
    if !claims.roles.iter().any(|r| r == "role.hq.admin") {
        return Err(StatusCode::FORBIDDEN);
    }

    let hq_id = claims.hq_id;

    let participants = match sqlx::query_as::<_, ParticipantDetail>(
        r#"
        SELECT 
            p.id, p.name, p.date_of_birth, p.gender,
            c.name AS customer_name,
            c.phone_number AS customer_phone,
            pp.current_total_points,
            hr.name_key AS rank_name_key,
            b.id as base_id,
            b.name as base_name,
            
            -- (★ V16.3 新增: 最近一次实到上课时间)
            (
                SELECT MAX(cl.start_time)
                FROM class_enrollments ce
                JOIN classes cl ON ce.class_id = cl.id
                WHERE ce.participant_id = p.id 
                  AND ce.status = 'completed'
            ) as last_class_time

        FROM participants p
        JOIN customers c ON p.customer_id = c.id
        LEFT JOIN bases b ON c.base_id = b.id 
        LEFT JOIN participant_profiles pp ON p.id = pp.participant_id
        LEFT JOIN honor_ranks hr ON pp.current_honor_rank_id = hr.id
        WHERE p.hq_id = $1
        ORDER BY p.created_at DESC
        "#,
    )
    .bind(hq_id) 
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(list) => list,
        Err(e) => {
            tracing::error!("Failed to fetch participants: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(participants))
}

// (★ V16.2 Step 2: 新增统计接口)
// GET /api/v1/hq/participants/stats
pub async fn get_hq_participant_stats(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<crate::models::TenantParticipantStats>, StatusCode> {
    
    if !claims.roles.iter().any(|r| r == "role.hq.admin") {
        return Err(StatusCode::FORBIDDEN);
    }

    let hq_id = claims.hq_id;

    let stats = match sqlx::query_as::<_, crate::models::TenantParticipantStats>(
        r#"
        SELECT
            -- 1. 总学员数
            (SELECT COUNT(*) FROM participants WHERE hq_id = $1) AS total_count,
            
            -- 2. 本月新增 (使用 date_trunc 截取当月第一天)
            (SELECT COUNT(*) FROM participants 
             WHERE hq_id = $1 
             AND created_at >= date_trunc('month', CURRENT_DATE)) AS new_this_month,
             
            -- 3. 付费会员 (持有有效会员卡的去重学员数)
            (SELECT COUNT(DISTINCT participant_id) 
             FROM customer_memberships 
             WHERE hq_id = $1 AND is_active = true AND participant_id IS NOT NULL) AS active_members
        "#,
    )
    .bind(hq_id)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(s) => s,
        Err(e) => {
            tracing::error!("Failed to fetch participant stats: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(stats))
}

// GET /api/v1/hq/dashboard/stats - 总部看板核心指标
pub async fn get_hq_dashboard_stats_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<DashboardStats>, StatusCode> {
    // ✅ Allow both HQ admin and finance roles
    if !claims.roles.iter().any(|r| r == "role.hq.admin" || r == "role.hq.finance") {
        return Err(StatusCode::FORBIDDEN);
    }

    let hq_id = claims.hq_id;

    // 获取核心统计
    let stats_row = sqlx::query!(
        r#"
        SELECT
            (SELECT COUNT(*) FROM bases WHERE hq_id = $1) as total_bases,
            (SELECT COUNT(*) FROM bases WHERE hq_id = $1 AND status = 'active') as active_bases,
            (SELECT COUNT(*) FROM participants WHERE hq_id = $1) as total_students,
            (SELECT COALESCE(SUM(total_amount_cents), 0) FROM orders WHERE hq_id = $1 AND status IN ('paid', 'completed') AND created_at >= CURRENT_DATE) as today_revenue,
            (SELECT COALESCE(SUM(total_amount_cents), 0) FROM orders WHERE hq_id = $1 AND status IN ('paid', 'completed') AND created_at >= date_trunc('month', CURRENT_DATE)) as month_revenue,
            (SELECT COALESCE(SUM(total_amount_cents), 0) FROM orders WHERE hq_id = $1 AND status IN ('paid', 'completed') AND created_at >= CURRENT_DATE - INTERVAL '1 day' AND created_at < CURRENT_DATE) as yesterday_revenue,
            (SELECT COUNT(*) FROM participants WHERE hq_id = $1 AND created_at >= CURRENT_DATE) as today_new_students,
            (SELECT COUNT(*) FROM participants WHERE hq_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '1 day' AND created_at < CURRENT_DATE) as yesterday_new_students,
            (SELECT COUNT(*) FROM finance_payment_records WHERE hq_id = $1 AND status = 'PENDING') as pending_audit_count
        "#,
        hq_id
    )
    .fetch_one(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch HQ dashboard stats: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 计算增长率
    let revenue_growth = if stats_row.yesterday_revenue.unwrap_or(0) > 0 {
        ((stats_row.today_revenue.unwrap_or(0) - stats_row.yesterday_revenue.unwrap_or(0)) as f64 / stats_row.yesterday_revenue.unwrap_or(0) as f64) * 100.0
    } else {
        0.0
    };

    let student_growth = if stats_row.yesterday_new_students.unwrap_or(0) > 0 {
        ((stats_row.today_new_students.unwrap_or(0) - stats_row.yesterday_new_students.unwrap_or(0)) as f64 / stats_row.yesterday_new_students.unwrap_or(0) as f64) * 100.0
    } else {
        0.0
    };

    // 获取最近 7 天趋势
    let revenue_trend_rows = sqlx::query!(
        r#"
        SELECT 
            d.day::date as "date!",
            COALESCE(SUM(o.total_amount_cents), 0) as "revenue!"
        FROM (
            SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day')::date as day
        ) d
        LEFT JOIN orders o ON date(o.created_at) = d.day AND o.hq_id = $1 AND o.status IN ('paid', 'completed')
        GROUP BY d.day
        ORDER BY d.day ASC
        "#,
        hq_id
    )
    .fetch_all(&state.db_pool)
    .await
    .unwrap_or_default();

    let student_trend_rows = sqlx::query!(
        r#"
        SELECT 
            d.day::date as "date!",
            COUNT(p.id) as "count!"
        FROM (
            SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day')::date as day
        ) d
        LEFT JOIN participants p ON date(p.created_at) = d.day AND p.hq_id = $1
        GROUP BY d.day
        ORDER BY d.day ASC
        "#,
        hq_id
    )
    .fetch_all(&state.db_pool)
    .await
    .unwrap_or_default();

    // 获取基地排行
    let rankings = sqlx::query_as::<_, BaseRankingItem>(
        r#"
        SELECT 
            b.id as base_id,
            b.name as base_name,
            SUM(o.total_amount_cents) as total_income
        FROM bases b
        LEFT JOIN orders o ON b.id = o.base_id AND o.status IN ('paid', 'completed')
        WHERE b.hq_id = $1
        GROUP BY b.id, b.name
        ORDER BY total_income DESC NULLS LAST
        LIMIT 5
        "#
    )
    .bind(hq_id)
    .fetch_all(&state.db_pool)
    .await
    .unwrap_or_default();

    // ✅ 获取支出构成 (按类别统计本月支出)
    let expense_rows = sqlx::query!(
        r#"
        SELECT 
            category,
            SUM(amount_cents) as "total_amount!"
        FROM expenses
        WHERE hq_id = $1 
            AND status = 'approved'
            AND created_at >= date_trunc('month', CURRENT_DATE)
        GROUP BY category
        ORDER BY 2 DESC
        "#,
        hq_id
    )
    .fetch_all(&state.db_pool)
    .await
    .unwrap_or_default();

    // 计算总支出
    let total_expenses: i64 = expense_rows.iter().map(|r| r.total_amount).sum();

    // 构造支出构成数据
    let expense_composition: Vec<crate::models::ExpenseComposition> = if total_expenses > 0 {
        expense_rows.iter().map(|row| {
            let percentage = (row.total_amount as f64 / total_expenses as f64) * 100.0;
            let (category_name, color) = match row.category.as_str() {
                "salary" => ("人员薪资", "bg-blue-500"),
                "rent" => ("房租物业", "bg-indigo-500"),
                "utility" => ("水电杂费", "bg-cyan-500"),
                "supplies" => ("采购物料", "bg-orange-500"),
                "marketing" => ("营销推广", "bg-green-500"),
                "other" => ("其他支出", "bg-gray-500"),
                _ => ("未分类", "bg-gray-400"),
            };
            
            crate::models::ExpenseComposition {
                category: row.category.clone(),
                category_name: category_name.to_string(),
                total_amount: row.total_amount,
                percentage: (percentage * 10.0).round() / 10.0, // 保留1位小数
                color: color.to_string(),
            }
        }).collect()
    } else {
        vec![]
    };

    Ok(Json(DashboardStats {
        total_bases: stats_row.total_bases.unwrap_or(0),
        today_revenue: stats_row.today_revenue.unwrap_or(0),
        month_revenue: stats_row.month_revenue.unwrap_or(0),
        revenue_growth_rate: revenue_growth,
        today_new_students: stats_row.today_new_students.unwrap_or(0),
        student_growth_rate: student_growth,
        active_bases: stats_row.active_bases.unwrap_or(0),
        pending_audit_count: stats_row.pending_audit_count.unwrap_or(0),
        revenue_trend: revenue_trend_rows.iter().map(|r| r.revenue).collect(),
        trend_dates: revenue_trend_rows.iter().map(|r| r.date.format("%m-%d").to_string()).collect(),
        student_trend: student_trend_rows.iter().map(|r| r.count).collect(),
        base_rankings: rankings,
        expense_composition, // ✅ 返回真实数据
    }))
}

// GET /api/v1/hq/dashboard/analytics - 总部看板深度分析
pub async fn get_hq_dashboard_analytics_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<AdvancedDashboardStats>, StatusCode> {
    // ✅ Allow admin, finance, and operation roles for analytics
    if !claims.roles.iter().any(|r| r == "role.hq.admin" || r == "role.hq.finance" || r == "role.hq.operation") {
        return Err(StatusCode::FORBIDDEN);
    }

    let hq_id = claims.hq_id;

    let stats = sqlx::query!(
        r#"
        SELECT
            (SELECT COUNT(*) FROM trial_classes tc JOIN bases b ON tc.base_id = b.id WHERE b.hq_id = $1 AND tc.created_at >= date_trunc('week', CURRENT_DATE)) as trial_count,
            (SELECT COUNT(*) FROM leads WHERE hq_id = $1 AND created_at >= date_trunc('week', CURRENT_DATE)) as leads_count,
            (SELECT COUNT(*) FROM customer_memberships WHERE hq_id = $1 AND created_at >= date_trunc('week', CURRENT_DATE)) as members_count,
            (SELECT COUNT(*) FROM users WHERE hq_id = $1 AND staff_status = 'pending') as pending_count,
            (SELECT COUNT(*) FROM users WHERE hq_id = $1) as total_staff,
            (SELECT COUNT(DISTINCT participant_id) FROM customer_memberships WHERE hq_id = $1 AND is_active = true AND participant_id IS NOT NULL) as active_members,
            (SELECT COUNT(*) FROM participants WHERE hq_id = $1) as total_students
        "#,
        hq_id
    )
    .fetch_one(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch HQ dashboard analytics: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let conversion_rate = if stats.leads_count.unwrap_or(0) > 0 {
        (stats.members_count.unwrap_or(0) as f64 / stats.leads_count.unwrap_or(0) as f64) * 100.0
    } else {
        0.0
    };

    let active_rate = if stats.total_students.unwrap_or(0) > 0 {
        (stats.active_members.unwrap_or(0) as f64 / stats.total_students.unwrap_or(0) as f64) * 100.0
    } else {
        0.0
    };

    Ok(Json(AdvancedDashboardStats {
        trial_class_count: stats.trial_count.unwrap_or(0),
        new_leads_count: stats.leads_count.unwrap_or(0),
        new_members_count: stats.members_count.unwrap_or(0),
        conversion_rate,
        active_rate,
        staff_pending_count: stats.pending_count.unwrap_or(0),
        staff_total_count: stats.total_staff.unwrap_or(0),
    }))
}

// GET /api/v1/hq/dashboard/pending-staff - 待入职员工列表
pub async fn get_hq_dashboard_pending_staff_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<PendingStaff>>, StatusCode> {
    if !claims.roles.iter().any(|r| r == "role.hq.admin" || r == "role.hq.hr") {
        return Err(StatusCode::FORBIDDEN);
    }

    let hq_id = claims.hq_id;

    let staff = sqlx::query_as::<_, PendingStaff>(
        r#"
        SELECT 
            u.full_name,
            COALESCE(r.name, '员工') as role_name,
            u.created_at
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.hq_id = $1 AND u.staff_status = 'pending'
        ORDER BY u.created_at DESC
        LIMIT 10
        "#
    )
    .bind(hq_id)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch pending staff: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(staff))
}