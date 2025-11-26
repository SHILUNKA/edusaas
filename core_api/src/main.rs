/*
 * src/main.rs
 * (★ V8.0 - 终极完整版: 动态 CORS + 全功能路由 ★)
 */
use axum::{
    routing::{get, post, patch},
    Router,
    http::{Method, StatusCode},
};
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use std::env;
use dotenvy::dotenv;

// --- 导入 TraceLayer (日志) ---
use tower_http::trace::TraceLayer;
use tracing::Level;

// --- 导入 CorsLayer (CORS) ---
use tower_http::cors::CorsLayer;
use axum::http::header; 

// --- 模块 ---
mod handlers;
mod models;

use handlers::{
    AppState,
    db_health_handler,
    ai_health_handler,
    register_handler,
    login_handler,
    
    // Base
    get_tenant_bases_handler, 
    create_tenant_base_handler, 
    
    // Asset & Material
    create_asset_type_handler,
    get_asset_types_handler,
    create_material_handler,
    get_materials_handler,
    
    // Customer & Participant
    create_customer_handler, 
    get_customers_handler,   
    create_participant_handler, 
    get_participants_for_customer_handler, 
    get_participants_handler, 
    
    // Dashboard
    get_dashboard_stats, 
    get_base_dashboard_stats, 
    get_all_tenant_participants,
    
    // Membership & CRM
    create_membership_tier_handler,
    get_membership_tiers_handler,
    assign_membership_handler,
    get_customer_memberships_handler,
    get_base_memberships_handler,
    
    // Course, Room, Teacher
    create_course_handler,
    get_courses_handler,
    create_room_handler, 
    get_tenant_rooms_handler, 
    get_base_rooms_handler,   
    get_base_teachers_handler, 
    
    // Class & Enrollment (排课)
    create_base_class_handler, 
    get_base_classes_handler, 
    update_class_handler, // (★ 确保导入了 PATCH 接口)
    create_enrollment_handler, 
    get_enrollments_for_class_handler,
    complete_enrollment_handler,
    delete_enrollment_handler,
    delete_class_handler,
    
    // Honor & User
    create_honor_rank, 
    get_honor_ranks,
    update_honor_rank,
    get_tenant_users,
    create_tenant_user,
    
    // Stock & Procurement
    get_stock_alerts_handler,
    get_base_stock_handler,
    create_procurement_order,
    get_procurement_orders,
    get_procurement_details,
    update_procurement_status,
    
    // AI Scheduling
    // (如果之前实现了 schedule_ai.rs，这里也需要导入，暂略以保证当前功能跑通)
};

#[tokio::main]
async fn main() {
    dotenv().ok();
    tracing_subscriber::fmt::init();

    // 1. 基础配置
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let jwt_secret = env::var("JWT_SECRET").expect("JWT_SECRET must be set");
    let ai_api_url = env::var("AI_API_URL").unwrap_or_else(|_| "http://edusaas_ai_api:8000".to_string());
    
    // 2. 动态 CORS 配置 (★ 核心修改)
    // 从环境变量读取允许的 Origin，如果没设置则默认 localhost:3000
    let cors_origins_str = env::var("CORS_ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:3000".to_string());

    // 解析逗号分隔的 URL 列表
    let allowed_origins: Vec<axum::http::HeaderValue> = cors_origins_str
        .split(',')
        .map(|s| s.trim().parse::<axum::http::HeaderValue>().expect("Invalid CORS origin URL"))
        .collect();

    tracing::info!("🌐 CORS allowed origins: {:?}", allowed_origins);

    // 3. App State
    let http_client = reqwest::Client::new();
    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to Postgres");

    let app_state = AppState {
        db_pool: pool,
        jwt_secret,
        ai_api_url,
        http_client,
    };

    // 4. 构建 CORS Layer
    let cors = CorsLayer::new()
        .allow_origin(allowed_origins) // 使用动态列表
        .allow_methods([
            Method::GET, Method::POST, Method::OPTIONS, Method::PUT, Method::DELETE, Method::PATCH,
        ])
        .allow_headers([
            header::CONTENT_TYPE,
            header::AUTHORIZATION,
            header::ACCEPT,
            header::ORIGIN,
            header::COOKIE,
            header::USER_AGENT,
            header::ACCESS_CONTROL_REQUEST_HEADERS,
            header::ACCESS_CONTROL_REQUEST_METHOD,
        ])
        .allow_credentials(true)
        .max_age(std::time::Duration::from_secs(86400));

    // 5. 定义路由
    let app = Router::new()
        .route("/health/db", get(db_health_handler))
        .route("/health/ai", get(ai_health_handler))
        
        // Auth
        .route("/api/v1/auth/register", post(register_handler))
        .route("/api/v1/auth/login", post(login_handler))
        
        // Base
        .route("/api/v1/bases", get(get_tenant_bases_handler))
        .route("/api/v1/bases", post(create_tenant_base_handler))
        
        // Asset/Material
        .route("/api/v1/asset-types", post(create_asset_type_handler))
        .route("/api/v1/asset-types", get(get_asset_types_handler))
        .route("/api/v1/materials", post(create_material_handler))
        .route("/api/v1/materials", get(get_materials_handler))
        
        // Customer/Participant
        .route("/api/v1/customers", post(create_customer_handler))
        .route("/api/v1/customers", get(get_customers_handler))
        .route("/api/v1/participants", post(create_participant_handler))
        .route("/api/v1/participants", get(get_participants_handler)) 
        .route("/api/v1/customers/:id/participants", get(get_participants_for_customer_handler))
        
        // Dashboard
        .route("/api/v1/dashboard/stats", get(get_dashboard_stats))
        .route("/api/v1/tenant/participants", get(get_all_tenant_participants))
        .route("/api/v1/tenant/users", get(get_tenant_users))
        .route("/api/v1/tenant/users", post(create_tenant_user))

        // Membership & CRM
        .route("/api/v1/membership-tiers", post(create_membership_tier_handler))
        .route("/api/v1/membership-tiers", get(get_membership_tiers_handler))
        .route("/api/v1/customer-memberships", post(assign_membership_handler)) 
        .route("/api/v1/customers/:id/memberships", get(get_customer_memberships_handler))
        .route("/api/v1/base/customer-memberships", get(get_base_memberships_handler))

        // Course/Room/Teacher
        .route("/api/v1/courses", post(create_course_handler))
        .route("/api/v1/courses", get(get_courses_handler))
        .route("/api/v1/tenant/rooms", get(get_tenant_rooms_handler).post(create_room_handler)) 
        .route("/api/v1/base/rooms", get(get_base_rooms_handler)) 
        .route("/api/v1/base/teachers", get(get_base_teachers_handler))

        // Class (排课)
        .route("/api/v1/base/classes", post(create_base_class_handler)) 
        .route("/api/v1/base/classes", get(get_base_classes_handler))
        // (★ 关键: 注册代课/修改接口)
        .route("/api/v1/base/classes/:id", patch(update_class_handler))
        .route("/api/v1/base/classes/:id", axum::routing::delete(delete_class_handler))
        
        // Enrollment
        .route("/api/v1/enrollments", post(create_enrollment_handler))
        .route("/api/v1/classes/:id/enrollments", get(get_enrollments_for_class_handler))
        .route("/api/v1/enrollments/:id/complete", patch(complete_enrollment_handler))
        .route("/api/v1/enrollments/:id", axum::routing::delete(delete_enrollment_handler))

        // Honor Rank
        .route("/api/v1/honor-ranks", post(create_honor_rank))
        .route("/api/v1/honor-ranks", get(get_honor_ranks))
        .route("/api/v1/honor-ranks/:id", axum::routing::put(update_honor_rank))

        // Stock
        .route("/api/v1/base/stock/alerts", get(get_stock_alerts_handler))
        .route("/api/v1/base/stock", get(get_base_stock_handler))

        // Procurement
        .route("/api/v1/procurements", post(create_procurement_order))
        .route("/api/v1/procurements", get(get_procurement_orders))
        .route("/api/v1/procurements/:id/items", get(get_procurement_details))
        .route("/api/v1/procurements/:id/status", axum::routing::put(update_procurement_status))

        // Phase 4 看板 (分店)
        .route("/api/v1/base/dashboard/stats", get(get_base_dashboard_stats))

        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(app_state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8000));
    tracing::info!("Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}