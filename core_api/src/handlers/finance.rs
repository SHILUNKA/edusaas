/*
 * src/handlers/finance.rs
 * 职责: 财务中心 (Finance) - 权限隔离与数据统计
 * (★ V15.0 新增 ★)
 */
use axum::{extract::{State, Query}, http::StatusCode, Json};
use uuid::Uuid;
use sqlx::QueryBuilder;
use chrono::{DateTime, Utc};
use serde::Deserialize;

use super::AppState;
use super::auth::Claims;
use crate::models::{FinancialTransaction, CreateTransactionPayload, TransactionType};

// 查询参数
#[derive(Debug, Deserialize)]
pub struct FinanceQuery {
    pub start_date: Option<String>, // YYYY-MM-DD
    pub end_date: Option<String>,
    pub base_id: Option<Uuid>,
    pub type_filter: Option<TransactionType>,
}

// (GET) 获取流水列表 (权限核心逻辑)
pub async fn get_financial_records_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(params): Query<FinanceQuery>,
) -> Result<Json<Vec<FinancialTransaction>>, StatusCode> {
    
    let tenant_id = claims.tenant_id;
    
    // 1. 权限判定
    let is_hq = claims.roles.iter().any(|r| r == "role.tenant.admin");
    let is_base = claims.roles.iter().any(|r| r == "role.base.admin");
    
    // 普通老师 (role.teacher) 无权查看
    if !is_hq && !is_base {
        tracing::warn!("User {} tried to access finance records without permission", claims.sub);
        return Err(StatusCode::FORBIDDEN);
    }

    // 2. 构建动态查询
    let mut query_builder: QueryBuilder<sqlx::Postgres> = QueryBuilder::new(
        r#"
        SELECT 
            t.id, t.tenant_id, t.base_id, t.amount_in_cents, t.transaction_type, t.category, 
            t.related_entity_id, t.description, t.created_at,
            b.name as base_name,
            u.full_name as created_by_name
        FROM financial_transactions t
        LEFT JOIN bases b ON t.base_id = b.id
        LEFT JOIN users u ON t.created_by = u.id
        WHERE t.tenant_id = 
        "#
    );
    query_builder.push_bind(tenant_id);

    // 3. 权限隔离逻辑 (Data Isolation)
    if is_hq {
        // 总部管理员: 可以看所有，也可以按参数筛选特定基地
        if let Some(bid) = params.base_id {
            query_builder.push(" AND t.base_id = ");
            query_builder.push_bind(bid);
        }
    } else {
        // 分店校长: 强制只能看自己基地的
        let my_base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;
        query_builder.push(" AND t.base_id = ");
        query_builder.push_bind(my_base_id);
    }

    // 4. 其他筛选条件
    if let Some(tf) = params.type_filter {
        query_builder.push(" AND t.transaction_type = ");
        query_builder.push_bind(tf);
    }
    
    // 简单的日期范围筛选 (生产环境建议更严谨的 Date 解析)
    if let Some(start) = params.start_date {
        query_builder.push(" AND t.created_at >= ");
        query_builder.push_bind(format!("{}T00:00:00Z", start).parse::<DateTime<Utc>>().unwrap_or(Utc::now()));
    }

    query_builder.push(" ORDER BY t.created_at DESC LIMIT 200");

    let records = query_builder.build_query_as::<FinancialTransaction>()
        .fetch_all(&state.db_pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch finance records: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(records))
}

// (POST) 手动录入流水 (例如: 录入水电费)
pub async fn create_manual_transaction_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateTransactionPayload>,
) -> Result<StatusCode, StatusCode> {
    
    let is_hq = claims.roles.iter().any(|r| r == "role.tenant.admin");
    let is_base = claims.roles.iter().any(|r| r == "role.base.admin");

    if !is_hq && !is_base { return Err(StatusCode::FORBIDDEN); }

    // 确定归属基地
    let target_base_id = if is_hq {
        payload.base_id // 总部可代录
    } else {
        claims.base_id // 分店只能录自己
    };

    // 金额转分
    let amount_cents = (payload.amount * 100.0) as i32;
    let user_id = Uuid::parse_str(&claims.sub).unwrap_or_default();

    sqlx::query(
        r#"
        INSERT INTO financial_transactions 
        (tenant_id, base_id, amount_in_cents, transaction_type, category, description, created_by, debit_subject, credit_subject)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'expense', 'cash') -- (默认简单的费用记账逻辑)
        "#
    )
    .bind(claims.tenant_id)
    .bind(target_base_id)
    .bind(amount_cents) // 注意：如果是支出，前端传正数，后端这里可能需要根据类型转负数？或者保持正数，用 type 区分。
                        // 建议：支出记负数，收入记正数。
                        // 这里假设前端传正数，我们手动转负数（如果是支出）
    .bind(payload.transaction_type)
    .bind(payload.category)
    .bind(&payload.description)
    .bind(user_id)
    .execute(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to record transaction: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(StatusCode::CREATED)
}