/*
 * src/handlers/mod.rs (V2 - 完整重构后的父模块)
 *
 * 职责:
 * 1. 定义所有 handler 共享的 AppState。
 * 2. 声明并导出所有子模块 (auth.rs, customer.rs, ...)。
 */

use sqlx::PgPool;
use uuid::Uuid;
use reqwest::StatusCode;

// --- 1. 共享的 AppState ---
// (AppState 留在父模块中, 以便子模块可以通过 super::AppState 访问)
#[derive(Clone)]
pub struct AppState {
    pub db_pool: PgPool,
    pub ai_api_url: String,
    pub http_client: reqwest::Client,
    pub jwt_secret: String,
}

// --- 2. 声明并导出所有子模块 ---

pub mod health;
pub use health::*;

pub mod auth;
pub use auth::*;

pub mod base;
pub use base::*;

pub mod customer;
pub use customer::*;

pub mod participant;
pub use participant::*;

pub mod honor;
pub use honor::*;

pub mod material;
pub use material::*;

pub mod asset;
pub use asset::*;

pub mod membership;
pub use membership::*;

pub mod course;
pub use course::*;

pub mod dashboard;
pub use dashboard::*;

pub mod hq;
pub use hq::*;

pub mod room;
pub use room::*;

pub mod teacher;
pub use teacher::*;

pub mod class;
pub use class::*;

pub mod enrollment;
pub use enrollment::*;

// --- 【新增】基地库存模块 ---
pub mod stock;
pub use stock::*;

// --- 【新增】员工管理模块 (必须添加这两行) ---
pub mod user;
pub use user::*;

pub mod procurement; // (新增)
pub use procurement::*;

pub mod schedule_ai;
pub use schedule_ai::*;

pub mod finance; // 新增
pub use finance::*;

pub mod supply;
pub use supply::*;

pub mod upload;
pub use upload::*;

// --- (★ V16.0 新增: 通用状态切换逻辑) ---
// 这是一个辅助函数，不是 Handler，供具体 Handler 调用
pub async fn toggle_status_common(
    pool: &PgPool,
    table_name: &str, // 传入表名 (例如 "courses", "membership_tiers")
    id: Uuid,
    hq_id: Uuid,
    is_active: bool,
) -> Result<StatusCode, StatusCode> {
    
    // 注意: 表名必须是硬编码传入的，防止 SQL 注入风险
    let query = format!(
        "UPDATE {} SET is_active = $1 WHERE id = $2 AND hq_id = $3",
        table_name
    );

    let result = sqlx::query(&query)
        .bind(is_active)
        .bind(id)
        .bind(hq_id)
        .execute(pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to toggle status for {}: {}", table_name, e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::OK)
}

