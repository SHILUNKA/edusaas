/*
 * src/main.rs
 * (★ V20.1 - 修复 Dashboard 路由引用错误 ★)
 */
use axum::{
    routing::{get, post, patch},
    Router,
    http::{Method},
};

use std::net::SocketAddr;
use std::env;
use dotenvy::dotenv;
use tower_http::trace::TraceLayer;
use tower_http::cors::CorsLayer;
use axum::http::header; 

mod handlers;
mod models;

// ★ 1. 在这里把所有用到的 Handler 都引入进来
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
    get_all_assets_handler,
    create_asset_handler,
    transfer_asset_handler, 
    delete_asset_handler,

    create_material_handler,
    get_materials_handler,
    
    // Customer & Participant
    create_customer_handler, 
    get_customers_handler,   
    create_participant_handler, 
    get_participants_for_customer_handler, 
    get_participants_handler,
    get_tenant_participant_stats,
    get_base_participants_handler,
    get_all_tenant_participants,
    
    // Dashboard (★ 修正这里: 引入正确的函数名)
    get_dashboard_stats_handler, 
    get_base_dashboard_stats_handler,
    // ↓ 新增的三个函数名
    get_dashboard_advanced_stats_handler, 
    get_pending_staff_list_handler,
    
    // Membership & CRM
    create_membership_tier_handler,
    get_membership_tiers_handler,
    assign_membership_handler,
    get_customer_memberships_handler,
    get_base_memberships_handler,
    toggle_tier_status_handler,
    
    // Course, Room, Teacher
    create_course_handler,
    update_course_handler,
    get_courses_handler,
    toggle_course_status_handler,
    create_room_handler, 
    get_rooms_handler,
    update_room_handler, 
    delete_room_handler,
    get_base_teachers_handler, 
    
    // Class & Enrollment
    create_base_class_handler, 
    get_base_classes_handler, 
    update_class_handler, 
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
    update_user_handler,
    
    // Stock & Procurement
    get_stock_alerts_handler,
    get_base_stock_handler,
    create_procurement_order,
    get_procurement_orders,
    get_procurement_details,
    update_procurement_status,
    
    // AI Scheduling
    get_teacher_config_handler,
    update_teacher_skills_handler,
    add_teacher_availability_handler,
    delete_teacher_availability_handler,
    trigger_auto_schedule_handler,

    // Financial
    get_financial_records_handler,
    create_manual_transaction_handler,
    get_orders_handler,
    create_order_handler,
    record_cost_handler,
};

#[tokio::main]
async fn main() {
    dotenv().ok();
    tracing_subscriber::fmt::init();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let jwt_secret = env::var("JWT_SECRET").expect("JWT_SECRET must be set");
    let ai_api_url = env::var("AI_API_URL").unwrap_or_else(|_| "http://edusaas_ai_api:8000".to_string());
    
    let cors_origins_str = env::var("CORS_ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:3000".to_string());

    let allowed_origins: Vec<axum::http::HeaderValue> = cors_origins_str
        .split(',')
        .map(|s| s.trim().parse::<axum::http::HeaderValue>().expect("Invalid CORS origin URL"))
        .collect();

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

    let cors = CorsLayer::new()
        .allow_origin(allowed_origins)
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
        .route("/api/v1/tenant/assets", get(get_all_assets_handler).post(create_asset_handler))
        .route("/api/v1/tenant/assets/:id", axum::routing::delete(delete_asset_handler))
        .route("/api/v1/tenant/assets/:id/transfer", axum::routing::put(transfer_asset_handler))
        
        .route("/api/v1/materials", post(create_material_handler))
        .route("/api/v1/materials", get(get_materials_handler))
        
        // Customer/Participant
        .route("/api/v1/customers", post(create_customer_handler))
        .route("/api/v1/customers", get(get_customers_handler))
        .route("/api/v1/participants", post(create_participant_handler))
        .route("/api/v1/participants", get(get_participants_handler)) 
        .route("/api/v1/customers/:id/participants", get(get_participants_for_customer_handler))
        .route("/api/v1/tenant/participants/stats", get(get_tenant_participant_stats))
        .route("/api/v1/base/participants", get(get_base_participants_handler))
        
        // === ★ Dashboard 路由修复 ★ ===
        // 1. 分店看板
        .route("/api/v1/base/dashboard/stats", get(get_base_dashboard_stats_handler))
        // 2. 总部基础看板
        .route("/api/v1/tenant/dashboard/stats", get(get_dashboard_stats_handler))
        // 3. 总部高级分析 (新) - 这里的 handler 名称要匹配上面的 use
        .route("/api/v1/tenant/dashboard/analytics", get(get_dashboard_advanced_stats_handler))
        // 4. HR 待入职名单 (新)
        .route("/api/v1/tenant/dashboard/pending-staff", get(get_pending_staff_list_handler))

        // 其他 User/Participant 路由
        .route("/api/v1/tenant/participants", get(get_all_tenant_participants))
        .route("/api/v1/tenant/users", get(get_tenant_users))
        .route("/api/v1/tenant/users", post(create_tenant_user))
        .route("/api/v1/tenant/users/:id", axum::routing::put(update_user_handler))

        // Membership
        .route("/api/v1/membership-tiers", post(create_membership_tier_handler))
        .route("/api/v1/membership-tiers", get(get_membership_tiers_handler))
        .route("/api/v1/customer-memberships", post(assign_membership_handler)) 
        .route("/api/v1/customers/:id/memberships", get(get_customer_memberships_handler))
        .route("/api/v1/base/customer-memberships", get(get_base_memberships_handler))
        .route("/api/v1/membership-tiers/:id/status", axum::routing::patch(toggle_tier_status_handler))

        // Course/Room/Teacher
        .route("/api/v1/courses", post(create_course_handler))
        .route("/api/v1/courses/:id", axum::routing::put(update_course_handler))
        .route("/api/v1/courses", get(get_courses_handler))
        .route("/api/v1/courses/:id/status", axum::routing::patch(toggle_course_status_handler))
        
        .route("/api/v1/rooms", get(get_rooms_handler).post(create_room_handler))
        .route("/api/v1/rooms/:id", axum::routing::put(update_room_handler).delete(delete_room_handler))
        .route("/api/v1/tenant/rooms", get(get_rooms_handler).post(create_room_handler))
        .route("/api/v1/base/rooms", get(get_rooms_handler))
        
        .route("/api/v1/base/teachers", get(get_base_teachers_handler))

        // Class & Enrollment
        .route("/api/v1/base/classes", post(create_base_class_handler)) 
        .route("/api/v1/base/classes", get(get_base_classes_handler))
        .route("/api/v1/base/classes/:id", patch(update_class_handler))
        .route("/api/v1/base/classes/:id", axum::routing::delete(delete_class_handler))
        
        .route("/api/v1/enrollments", post(create_enrollment_handler))
        .route("/api/v1/classes/:id/enrollments", get(get_enrollments_for_class_handler))
        .route("/api/v1/enrollments/:id/complete", patch(complete_enrollment_handler))
        .route("/api/v1/enrollments/:id", axum::routing::delete(delete_enrollment_handler))

        // Honor
        .route("/api/v1/honor-ranks", post(create_honor_rank))
        .route("/api/v1/honor-ranks", get(get_honor_ranks))
        .route("/api/v1/honor-ranks/:id", axum::routing::put(update_honor_rank))

        // Stock & Procurement
        .route("/api/v1/base/stock/alerts", get(get_stock_alerts_handler))
        .route("/api/v1/base/stock", get(get_base_stock_handler))

        .route("/api/v1/procurements", post(create_procurement_order))
        .route("/api/v1/procurements", get(get_procurement_orders))
        .route("/api/v1/procurements/:id/items", get(get_procurement_details))
        .route("/api/v1/procurements/:id/status", axum::routing::put(update_procurement_status))

        // AI Scheduling
        .route("/api/v1/teachers/:id/config", get(get_teacher_config_handler))
        .route("/api/v1/teachers/:id/skills", axum::routing::put(update_teacher_skills_handler))
        .route("/api/v1/teachers/:id/availability", post(add_teacher_availability_handler))
        .route("/api/v1/teachers/availability/:id", axum::routing::delete(delete_teacher_availability_handler))
        .route("/api/v1/base/schedule/auto-generate", post(trigger_auto_schedule_handler))

        // Finance
        // 1. 订单管理 (收入)
        .route("/api/v1/finance/orders", get(get_orders_handler).post(create_order_handler))
        // 2. 成本管理 (支出)
        .route("/api/v1/finance/costs", post(record_cost_handler))
        // 3. 资金流水 (保留)
        .route("/api/v1/finance/transactions", get(get_financial_records_handler).post(create_manual_transaction_handler))

        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(app_state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8000));
    tracing::info!("Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}