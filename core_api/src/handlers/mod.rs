/*
 * src/handlers/mod.rs (V2 - 完整重构后的父模块)
 *
 * 职责:
 * 1. 定义所有 handler 共享的 AppState。
 * 2. 声明并导出所有子模块 (auth.rs, customer.rs, ...)。
 */

use sqlx::PgPool;

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
pub use dashboard::{get_dashboard_stats, get_base_dashboard_stats};

pub mod tenant;
pub use tenant::*;

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

// ...
pub mod procurement; // (新增)
pub use procurement::*;
