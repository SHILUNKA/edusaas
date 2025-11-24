/*
 * main.rs (V6 - 专业 CORS 配置)
 */
use axum::{
    routing::{get, post, patch},
    Router,
    http::Method,
};
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use std::env;

// --- 导入 TraceLayer (日志) ---
use tower_http::trace::TraceLayer;
use tracing::Level;

// --- 导入 CorsLayer (CORS 修复) ---
use tower_http::cors::{CorsLayer};
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
    get_bases,
    create_base,
    create_customer,
    get_customers_handler,
    create_participant_handler,
    get_participants_for_customer_handler,
    get_participants_handler,
    create_honor_rank,
    get_honor_ranks,
    get_materials,
    create_material,
    get_asset_types,
    create_asset_type,
    get_membership_tiers,
    create_membership_tier,
    get_courses,
    create_course,
    get_dashboard_stats,
    get_all_tenant_participants,
    get_all_tenant_rooms,
    create_room,
    get_base_rooms,
    get_base_teachers,
    get_base_classes,
    create_base_class,
    create_enrollment_handler,
    get_enrollments_for_class_handler,
    complete_enrollment_handler,
    assign_membership_handler,
    get_base_dashboard_stats,
    get_stock_alerts_handler,
    get_tenant_users,
    create_tenant_user,
};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_max_level(Level::DEBUG)
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    dotenvy::dotenv().ok();
    
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");
    
    let db_pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    tracing::info!("Database connected successfully.");

    let ai_api_url = env::var("AI_API_URL")
        .expect("AI_API_URL must be set");

    let jwt_secret = env::var("JWT_SECRET")
        .expect("JWT_SECRET must be set");

    let http_client = reqwest::Client::new();
    
    let app_state = AppState {
        db_pool,
        ai_api_url,
        http_client,
        jwt_secret,
    };

    // --- 专业 CORS 配置 ---
    let cors = CorsLayer::new()
        // 允许的前端来源
        .allow_origin("http://localhost:3000".parse::<axum::http::HeaderValue>().unwrap())
        // 允许的 HTTP 方法
        .allow_methods([
            Method::GET,
            Method::POST, 
            Method::OPTIONS,
            Method::PUT,
            Method::DELETE,
            Method::PATCH,
        ])
        // 明确的请求头列表（与 allow_credentials 兼容）
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
        // 允许携带凭证（cookies、认证头等）
        .allow_credentials(true)
        // 预检请求缓存时间（秒）
        .max_age(std::time::Duration::from_secs(86400)); // 24小时

    // --- 定义路由 ---
    let app = Router::new()
        // Phase 0 Auth
        .route("/api/v1/auth/register", post(register_handler))
        .route("/api/v1/auth/login", post(login_handler))

        // Phase 0 路由
        .route("/", get(root_handler))
        .route("/health/db", get(db_health_handler))
        .route("/health/ai", get(ai_health_handler)) 

        // Phase 1 路由
        .route("/api/v1/honor-ranks", post(create_honor_rank))
        .route("/api/v1/honor-ranks", get(get_honor_ranks))
        
        .route("/api/v1/bases", get(get_bases))       
        .route("/api/v1/bases", post(create_base))

        .route("/api/v1/materials", get(get_materials))
        .route("/api/v1/materials", post(create_material))

        // Phase 2 资产类型
        .route("/api/v1/asset-types", get(get_asset_types))
        .route("/api/v1/asset-types", post(create_asset_type))
        
        // Phase 1 会员卡种
        .route("/api/v1/membership-tiers", get(get_membership_tiers))
        .route("/api/v1/membership-tiers", post(create_membership_tier))

        // Phase 2 课程
        .route("/api/v1/courses", get(get_courses))
        .route("/api/v1/courses", post(create_course))

        // Phase 3 看板
        .route("/api/v1/dashboard/stats", get(get_dashboard_stats))

        // Phase 3 学员总览
        .route("/api/v1/tenant/participants", get(get_all_tenant_participants))

        // Phase 4 教室
        .route("/api/v1/tenant/rooms", get(get_all_tenant_rooms))
        .route("/api/v1/tenant/rooms", post(create_room))

        // Phase 4 分店
        .route("/api/v1/base/teachers", get(get_base_teachers))     
        .route("/api/v1/base/classes", get(get_base_classes))   
        .route("/api/v1/base/classes", post(create_base_class))
        .route("/api/v1/base/rooms", get(get_base_rooms))

        .route("/api/v1/customers", post(create_customer))
        .route("/api/v1/customers", get(get_customers_handler))

        .route("/api/v1/participants", post(create_participant_handler))
        .route("/api/v1/participants", get(get_participants_handler))
        
        .route(
            "/api/v1/customers/:customer_id/participants",
            get(get_participants_for_customer_handler)
        )

        .route("/api/v1/enrollments", post(create_enrollment_handler))
        
        // 获取课程花名册路由
        .route(
            "/api/v1/classes/:class_id/enrollments",
            get(get_enrollments_for_class_handler)
        )

        // 教师结课路由
        .route(
            "/api/v1/enrollments/:enrollment_id",
            patch(complete_enrollment_handler)
        )

        // 分配会员卡路由
        .route("/api/v1/customer-memberships", post(assign_membership_handler))

        // Phase 4 看板 (分店)
        .route("/api/v1/base/dashboard/stats", get(get_base_dashboard_stats))
        
        // 基地库存警报路由
        .route("/api/v1/base/stock/alerts", get(get_stock_alerts_handler))

        .route("/api/v1/tenant/users", get(get_tenant_users))
        .route("/api/v1/tenant/users", post(create_tenant_user))    

        // --- 应用中间件层 ---
        // 注意：Layer 的顺序很重要，CORS 应该在 Trace 之前
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(app_state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8000));
    tracing::info!("Core API (Rust) listening on {}", addr);
    tracing::info!("CORS configured for: http://localhost:3000");
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn root_handler() -> &'static str {
    "Hello from Rust (core_api)!"
}