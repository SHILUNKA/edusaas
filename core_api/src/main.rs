/*
 * src/main.rs (修复版)
 */
use axum::{
    routing::{get, post, patch, put},
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
mod middleware; // 这里的 middleware 指的是 src/middleware.rs

use middleware::auth_middleware; // 引入我们自己写的鉴权函数

use tower_http::services::ServeDir;

use handlers::{
    AppState,
    db_health_handler, ai_health_handler, register_handler, login_handler,
    get_hq_bases_handler, create_hq_base_handler, update_hq_base_handler,
    create_asset_type_handler, get_asset_types_handler, get_all_assets_handler,
    create_asset_handler, transfer_asset_handler, delete_asset_handler,
    create_material_handler, get_materials_handler,
    create_customer_handler, get_customers_handler, create_participant_handler, 
    get_participants_for_customer_handler, get_participants_handler,
    get_hq_participant_stats, get_base_participants_handler, get_all_hq_participants,
    get_dashboard_overview_handler, get_workspace_overview_handler, 
    get_approval_list_handler, handle_approval_action_handler,
    get_finance_summary_handler, get_base_staff_list_handler,
    get_report_stats_handler, create_notice_handler,
    create_membership_tier_handler, get_membership_tiers_handler, assign_membership_handler,
    get_customer_memberships_handler, get_base_memberships_handler, toggle_tier_status_handler,
    create_course_handler, update_course_handler, get_courses_handler, toggle_course_status_handler,
    create_room_handler, get_rooms_handler, update_room_handler, delete_room_handler,
    get_base_teachers_handler, get_teacher_dashboard_handler, create_base_class_handler, get_base_classes_handler, 
    update_class_handler, create_enrollment_handler, get_enrollments_for_class_handler,
    complete_enrollment_handler, delete_enrollment_handler, delete_class_handler,
    create_honor_rank, get_honor_ranks, update_honor_rank, get_hq_users,
    create_hq_user, update_user_handler, get_stock_alerts_handler, get_base_stock_handler,
    create_procurement_order, get_procurement_orders, get_procurement_details, update_procurement_status,
    get_teacher_config_handler, update_teacher_skills_handler, add_teacher_availability_handler,
    delete_teacher_availability_handler, trigger_auto_schedule_handler,
    create_income_order_handler, get_income_orders_handler,update_income_order_handler, cancel_income_order_handler,
    create_expense_handler, get_expenses_handler, get_payment_records_handler, verify_payment_handler, 
    get_hq_products_handler, create_supply_order_handler, upload_payment_proof_handler,
    get_all_supply_orders_handler, confirm_supply_payment_handler, ship_supply_order_handler,
    create_product_handler, update_product_handler, get_base_supply_orders_handler,receive_supply_order_handler,
    consume_inventory_handler,get_inventory_logs_handler,get_base_inventory_handler,restock_inventory_handler,
    get_hq_finance_dashboard_handler,submit_payment_proof_handler,
    get_order_items_handler,
    update_invoice_status_handler,upload_file_handler,
    get_base_finance_dashboard_handler,
    generate_qrcodes_handler, verify_qrcode_handler, export_batch_csv_handler,list_batches_handler, activate_batch_handler,
    get_staff_risk_stats_handler, get_key_personnel_handler, get_purchase_rankings_handler, get_activity_rankings_handler,
    get_hq_dashboard_stats_handler, get_hq_dashboard_analytics_handler, get_hq_dashboard_pending_staff_handler,
    get_top_products_handler, get_order_trend_handler, get_funnel_data_handler,
    get_leads_handler, create_lead_handler, get_lead_detail_handler, update_lead_handler, add_follow_up_handler,
    get_trial_classes_handler, create_trial_class_handler, get_trial_class_handler, update_trial_class_handler, add_trial_class_feedback_handler,
    // C端API handlers
    get_customer_profile_handler, get_customer_schedule_handler, get_course_balance_handler,
    get_customer_honor_handler, get_points_history_handler,
    get_customer_orders_handler, get_customer_membership_tiers_handler, get_customer_notices_handler,
    get_customer_participant_report_handler,
    // C端认证handlers
    wechat_login_handler, bind_phone_handler, generate_miniprogram_code_handler,
};


#[tokio::main]
async fn main() {
    dotenv().ok();
    tracing_subscriber::fmt::init();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let jwt_secret = env::var("JWT_SECRET").expect("JWT_SECRET must be set");
    let ai_api_url = env::var("AI_API_URL").unwrap_or_else(|_| "http://edusaas_ai_api:8000".to_string());
    
    let cors_origins_str = env::var("CORS_ALLOWED_ORIGINS").unwrap_or_else(|_| "http://localhost:3000".to_string());
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

    // 运行迁移 (运行时)
    println!("📦 Running database migrations...");
    sqlx::migrate!("./migrations") 
        .run(&pool)
        .await
        .expect("Failed to run database migrations");
    println!("✅ Migrations success!");

    let app_state = AppState {
        db_pool: pool,
        jwt_secret,
        ai_api_url,
        http_client,
    };

    let cors = CorsLayer::new()
        .allow_origin(allowed_origins)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS, Method::PUT, Method::DELETE, Method::PATCH])
        .allow_headers([
            header::CONTENT_TYPE, header::AUTHORIZATION, header::ACCEPT, header::ORIGIN,
            header::COOKIE, header::USER_AGENT, header::ACCESS_CONTROL_REQUEST_HEADERS,
            header::ACCESS_CONTROL_REQUEST_METHOD,
        ])
        .allow_credentials(true)
        .max_age(std::time::Duration::from_secs(86400));

    let public_routes = Router::new()
        .route("/health/db", get(db_health_handler))
        .route("/health/ai", get(ai_health_handler))
        .route("/api/v1/auth/register", post(register_handler))
        .route("/api/v1/auth/login", post(login_handler))
        .route("/api/v1/auth/wechat-login", post(wechat_login_handler))  // C端微信登录
        .route("/api/v1/base/generate-miniprogram-code", post(generate_miniprogram_code_handler))
        .route("/api/v1/verify/:code", get(verify_qrcode_handler));

    let protected_routes = Router::new()
        .route("/api/v1/bases", get(get_hq_bases_handler).post(create_hq_base_handler))
        .route("/api/v1/bases/:id", axum::routing::put(update_hq_base_handler))
        .route("/api/v1/asset-types", post(create_asset_type_handler).get(get_asset_types_handler))
        .route("/api/v1/hq/assets", get(get_all_assets_handler).post(create_asset_handler))
        .route("/api/v1/hq/assets/:id", axum::routing::delete(delete_asset_handler))
        .route("/api/v1/hq/assets/:id/transfer", axum::routing::put(transfer_asset_handler))
        .route("/api/v1/materials", post(create_material_handler).get(get_materials_handler))
        .route("/api/v1/customers", post(create_customer_handler).get(get_customers_handler))
        .route("/api/v1/participants", post(create_participant_handler).get(get_participants_handler)) 
        .route("/api/v1/customers/:id/participants", get(get_participants_for_customer_handler))
        .route("/api/v1/hq/participants/stats", get(get_hq_participant_stats))
        .route("/api/v1/base/participants", get(get_base_participants_handler))
        .route("/api/v1/base/dashboard/overview", get(get_dashboard_overview_handler))
        .route("/api/v1/base/workspace/overview", get(get_workspace_overview_handler))
        .route("/api/v1/base/approval/list", get(get_approval_list_handler))
        .route("/api/v1/base/approval/action", post(handle_approval_action_handler))
        .route("/api/v1/base/finance/summary", get(get_finance_summary_handler))
        .route("/api/v1/base/staff/list", get(get_base_staff_list_handler))
        .route("/api/v1/base/report/stats", get(get_report_stats_handler))
        .route("/api/v1/base/notice/create", post(create_notice_handler))
        .route("/api/v1/base/finance/dashboard_data", get(get_base_finance_dashboard_handler))
        .route("/api/v1/hq/participants", get(get_all_hq_participants))
        .route("/api/v1/hq/users", get(get_hq_users).post(create_hq_user))
        .route("/api/v1/hq/users/:id", axum::routing::put(update_user_handler))
        .route("/api/v1/membership-tiers", post(create_membership_tier_handler).get(get_membership_tiers_handler))
        .route("/api/v1/customer-memberships", post(assign_membership_handler)) 
        .route("/api/v1/customers/:id/memberships", get(get_customer_memberships_handler))
        .route("/api/v1/base/customer-memberships", get(get_base_memberships_handler))
        .route("/api/v1/membership-tiers/:id/status", axum::routing::patch(toggle_tier_status_handler))
        .route("/api/v1/courses", post(create_course_handler).get(get_courses_handler))
        .route("/api/v1/courses/:id", axum::routing::put(update_course_handler))
        .route("/api/v1/courses/:id/status", axum::routing::patch(toggle_course_status_handler))
        .route("/api/v1/rooms", get(get_rooms_handler).post(create_room_handler))
        .route("/api/v1/rooms/:id", axum::routing::put(update_room_handler).delete(delete_room_handler))
        .route("/api/v1/hq/rooms", get(get_rooms_handler).post(create_room_handler))
        .route("/api/v1/base/rooms", get(get_rooms_handler))
        .route("/api/v1/base/teachers", get(get_base_teachers_handler))
        .route("/api/v1/base/classes", post(create_base_class_handler).get(get_base_classes_handler))
        .route("/api/v1/base/classes/:id", patch(update_class_handler).delete(delete_class_handler))
        .route("/api/v1/enrollments", post(create_enrollment_handler))
        .route("/api/v1/classes/:id/enrollments", get(get_enrollments_for_class_handler))
        .route("/api/v1/enrollments/:id/complete", patch(complete_enrollment_handler))
        .route("/api/v1/enrollments/:id", axum::routing::delete(delete_enrollment_handler))
        .route("/api/v1/honor-ranks", post(create_honor_rank).get(get_honor_ranks))
        .route("/api/v1/honor-ranks/:id", axum::routing::put(update_honor_rank))
        .route("/api/v1/base/stock/alerts", get(get_stock_alerts_handler))
        .route("/api/v1/base/stock", get(get_base_stock_handler))
        .route("/api/v1/procurements", post(create_procurement_order).get(get_procurement_orders))
        .route("/api/v1/procurements/:id/items", get(get_procurement_details))
        .route("/api/v1/procurements/:id/status", axum::routing::put(update_procurement_status))
        .route("/api/v1/teachers/:id/config", get(get_teacher_config_handler))
        .route("/api/v1/teachers/:id/skills", axum::routing::put(update_teacher_skills_handler))
        .route("/api/v1/teachers/:id/availability", post(add_teacher_availability_handler))
        .route("/api/v1/teachers/availability/:id", axum::routing::delete(delete_teacher_availability_handler))
        .route("/api/v1/teacher/dashboard", get(get_teacher_dashboard_handler))
        .route("/api/v1/base/schedule/auto-generate", post(trigger_auto_schedule_handler))
        .route("/api/v1/finance/payments/verify", post(verify_payment_handler))
        // 1. 收入订单
        .route("/api/v1/finance/orders", post(create_income_order_handler).get(get_income_orders_handler))
        .route("/api/v1/finance/orders/:id", put(update_income_order_handler))
        .route("/api/v1/finance/orders/:id/cancel", put(cancel_income_order_handler))
        // 2. 运营支出 (房租/工资)
        .route("/api/v1/finance/expenses", post(create_expense_handler).get(get_expenses_handler))
        
        .route("/api/v1/finance/orders/:id/items", get(get_order_items_handler))
        .route("/api/v1/finance/orders/:id/invoice", put(update_invoice_status_handler))

        // 3. 资金确认
        .route("/api/v1/finance/payments", get(get_payment_records_handler).post(submit_payment_proof_handler))
        .route("/api/v1/finance/payments/:id/verify", put(verify_payment_handler))
        // --- 供应链: 基地端 ---
        .route("/api/v1/supply/products", get(get_hq_products_handler).post(create_product_handler))
        .route("/api/v1/supply/products/:id", put(update_product_handler))
        .route("/api/v1/supply/orders",  post(create_supply_order_handler).get(get_base_supply_orders_handler))
        .route("/api/v1/supply/orders/:id/payment", post(upload_payment_proof_handler))
        .route("/api/v1/base/inventory", get(get_base_inventory_handler))
        .route("/api/v1/base/inventory/:id/consume", post(consume_inventory_handler))
        .route("/api/v1/base/inventory/logs", get(get_inventory_logs_handler))
        .route("/api/v1/supply/orders/:id/receive", put(receive_supply_order_handler))
        .route("/api/v1/base/inventory/:id/restock", post(restock_inventory_handler))
        
        // --- 供应链: 总部端 (HQ) ---
        .route("/api/v1/hq/dashboard/stats", get(get_hq_dashboard_stats_handler))
        .route("/api/v1/hq/dashboard/analytics", get(get_hq_dashboard_analytics_handler))
        .route("/api/v1/hq/dashboard/pending-staff", get(get_hq_dashboard_pending_staff_handler))
        .route("/api/v1/hq/supply/orders", get(get_all_supply_orders_handler))
        .route("/api/v1/hq/supply/orders/:id/confirm", put(confirm_supply_payment_handler))
        .route("/api/v1/hq/supply/orders/:id/ship", put(ship_supply_order_handler))

        .route("/api/v1/hq/finance/dashboard", get(get_hq_finance_dashboard_handler))

        .route("/api/v1/upload", post(upload_file_handler))
        
        // --- Staff/Personnel Risk Control ---
        .route("/api/v1/hq/staff/risk-stats", get(get_staff_risk_stats_handler))
        .route("/api/v1/hq/staff/key-personnel", get(get_key_personnel_handler))
        .route("/api/v1/hq/staff/rankings/purchase", get(get_purchase_rankings_handler))
        .route("/api/v1/hq/staff/rankings/activity", get(get_activity_rankings_handler))
        
        // --- Data Reports ---
        .route("/api/v1/hq/reports/top-products", get(get_top_products_handler))
        .route("/api/v1/hq/reports/order-trend", get(get_order_trend_handler))
        .route("/api/v1/hq/reports/funnel", get(get_funnel_data_handler))
        
        // --- Base: Lead Management ---
        .route("/api/v1/base/leads", get(get_leads_handler))
        .route("/api/v1/base/leads", post(create_lead_handler))
        .route("/api/v1/base/leads/:id", get(get_lead_detail_handler))
        .route("/api/v1/base/leads/:id", put(update_lead_handler))
        .route("/api/v1/base/leads/:id/follow-up", post(add_follow_up_handler))
        
        // --- Base: Trial Class Management ---
        .route("/api/v1/base/trial-classes", get(get_trial_classes_handler))
        .route("/api/v1/base/trial-classes", post(create_trial_class_handler))
        .route("/api/v1/base/trial-classes/:id", get(get_trial_class_handler))
        .route("/api/v1/base/trial-classes/:id", put(update_trial_class_handler))
        .route("/api/v1/base/trial-classes/:id/feedback", post(add_trial_class_feedback_handler))
        
        // --- C-End Customer APIs ---
        .route("/api/v1/customer/profile", get(get_customer_profile_handler))
        .route("/api/v1/customer/schedule", get(get_customer_schedule_handler))
        .route("/api/v1/customer/course-balance", get(get_course_balance_handler))
        .route("/api/v1/customer/honor", get(get_customer_honor_handler))
        .route("/api/v1/customer/points-history", get(get_points_history_handler))
        .route("/api/v1/customer/bind-phone", post(bind_phone_handler))
        .route("/api/v1/customer/orders", get(get_customer_orders_handler))
        .route("/api/v1/customer/membership-tiers", get(get_customer_membership_tiers_handler))
        .route("/api/v1/customer/notices", get(get_customer_notices_handler))
        .route("/api/v1/customer/report", get(get_customer_participant_report_handler))
        
        .route("/api/v1/hq/qrcodes/generate", post(generate_qrcodes_handler))

        .route("/api/v1/admin/qrcodes/:batch_id/export", get(export_batch_csv_handler))
        .route("/api/v1/admin/qrcodes/batches", get(list_batches_handler))
        .route("/api/v1/admin/qrcodes/:batch_id/activate", post(activate_batch_handler))

        
        // ★ 修复: 使用 axum::middleware::from_fn 调用，而不是 middleware::from_fn
        .route_layer(axum::middleware::from_fn(auth_middleware));

    let app = Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .nest_service("/uploads", ServeDir::new("uploads"))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(app_state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8000));
    tracing::info!("Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}