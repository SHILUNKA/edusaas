/*
 * core_api/src/models.rs
 * V25.7 - 完整修复版
 * 包含：
 * 1. 修复 CreateOrderPayload 字段为 Option，适配后端逻辑
 * 2. 统一 SubmitPaymentProofPayload 命名
 * 3. 补全 OrderDetail 字段 (sales_name, invoice_status 等)
 */
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, NaiveDate, Utc};

use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
};

// ==========================================
// 1. 认证与令牌 (Auth & Token)
// ==========================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub roles: Vec<String>,
    pub hq_id: Uuid,
    pub base_id: Option<Uuid>,
    pub base_name: Option<String>,
    pub base_logo: Option<String>,
    pub exp: usize,
}

#[async_trait]
impl<S> FromRequestParts<S> for Claims
where
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<Claims>()
            .cloned()
            .ok_or(StatusCode::UNAUTHORIZED)
    }
}

#[derive(Debug, Deserialize)]
pub struct AuthBody {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
}

// ==========================================
// 2. 全局枚举定义 (Enums)
// ==========================================

#[derive(Debug, Serialize, Deserialize, sqlx::Type, PartialEq, Eq, Clone, Copy)]
#[sqlx(type_name = "membership_tier_type", rename_all = "snake_case")]          
#[serde(rename_all = "snake_case")]
pub enum MembershipTierType { TimeBased, UsageBased }

#[derive(Debug, Serialize, Deserialize, sqlx::Type, PartialEq, Eq, Clone, Copy)]
#[sqlx(type_name = "asset_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AssetStatus { InStock, InUse, InClass, InMaintenance, Retired }

#[derive(Debug, Serialize, Deserialize, sqlx::Type, PartialEq, Eq, Clone, Copy)]
#[sqlx(type_name = "procurement_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ProcurementStatus { Pending, Approved, Rejected, Shipped, Received }

#[derive(Debug, Serialize, Deserialize, sqlx::Type, PartialEq, Eq, Clone, Copy)]
#[sqlx(type_name = "order_type", rename_all = "snake_case")] 
#[serde(rename_all = "snake_case")]
pub enum OrderType { B2b, B2c, B2g }

#[derive(Debug, Serialize, Deserialize, sqlx::Type, PartialEq, Eq, Clone, Copy)]
#[sqlx(type_name = "order_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum OrderStatus { Pending, PartialPaid, Paid, Completed, Refunded, Cancelled }

#[derive(Debug, Serialize, Deserialize, sqlx::Type, PartialEq, Eq, Clone, Copy)]
#[sqlx(type_name = "cost_category", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CostCategory { Transport, Catering, Accommodation, Labor, Material, Insurance, Other }

// ==========================================
// 3. 基础资源 (Tenant, Base)
// ==========================================

#[derive(Debug, Serialize, FromRow)]
pub struct Tenant {
    pub id: Uuid,
    pub name: String,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Base {
    pub id: Uuid,
    pub hq_id: Uuid,
    pub name: String, 
    pub address: Option<String>,
    pub code: Option<String>,
    pub logo_url: Option<String>,
    pub status: String, // "active", "suspended"
    pub operation_mode: String, // "direct", "franchise"
    
    #[sqlx(default)]
    pub student_count: i64,
    #[sqlx(default)]
    pub revenue_toc: f64, 
    #[sqlx(default)]
    pub revenue_tob: f64, 
}

#[derive(Debug, Deserialize)]
pub struct CreateBasePayload {
    pub name: String,
    pub address: Option<String>,
    pub code: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBasePayload {
    pub name: String,
    pub address: Option<String>,
    pub code: String,
    pub logo_url: Option<String>,
    pub status: String, 
    pub operation_mode: String, 
}

#[derive(Debug, Deserialize)]
pub struct UpdateStatusPayload {
    pub is_active: bool,
}

// ==========================================
// 4. 用户与权限 (User, Teacher)
// ==========================================

#[derive(Debug, Serialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub full_name: String,
    pub hq_id: Uuid,
    pub base_id: Option<Uuid>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub phone_number: Option<String>,
    #[sqlx(default)] 
    pub staff_status: Option<String>, 
    #[sqlx(default)]
    pub role_name: Option<String>, 
}

#[derive(Debug, Serialize, FromRow)]
pub struct UserDetail {
    pub id: Uuid,
    pub email: String,
    pub full_name: Option<String>,
    pub phone_number: Option<String>,
    pub gender: Option<String>,
    pub blood_type: Option<String>,
    pub date_of_birth: Option<NaiveDate>,
    pub address: Option<String>,
    pub is_active: bool,
    pub base_id: Option<Uuid>,
    pub base_name: Option<String>,
    pub role_name: Option<String>,
    pub created_at: DateTime<Utc>,
    #[sqlx(default)]
    pub staff_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[sqlx(default)] 
    pub initial_password: Option<String>,
    #[sqlx(default)]
    pub skills: Option<String>, 
    #[sqlx(default)]
    pub is_teaching_now: Option<bool>, 
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserPayload {
    pub full_name: Option<String>,
    pub phone_number: Option<String>,
    pub role_key: Option<String>,
    pub staff_status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateUserPayload {
    pub email: String,
    pub full_name: String,
    pub phone_number: Option<String>,
    pub gender: Option<String>,
    pub blood_type: Option<String>,
    pub date_of_birth: Option<NaiveDate>, 
    pub address: Option<String>,
    pub role_key: String,
    pub base_id: Option<Uuid>,
    pub password: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Teacher {
    pub user_id: Uuid,
    pub hq_id: Uuid,
    pub base_id: Option<Uuid>,
    pub bio: Option<String>,
    pub specialization: Option<String>,
    pub qualifications: Option<String>,
    pub is_active: bool,
    pub full_name: Option<String>, 
}

#[derive(Debug, Serialize, FromRow)]
pub struct HonorRank {
    pub id: Uuid,
    pub hq_id: Uuid,
    pub name_key: String, 
    pub rank_level: i32,
    pub points_required: i32,
    pub badge_icon_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateHonorRankPayload {
    pub name_key: String, 
    pub rank_level: i32,
    pub points_required: i32,
    pub badge_icon_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateHonorRankPayload {
    pub points_required: i32,
}

// ==========================================
// 5. 资产与物料 (Asset, Material)
// ==========================================

#[derive(Debug, Serialize, FromRow)]
pub struct Material {
    pub id: Uuid,
    pub hq_id: Uuid,
    pub name_key: String, 
    pub description_key: Option<String>,
    pub sku: Option<String>,
    pub unit_of_measure: Option<String>, 
}

#[derive(Debug, Deserialize)]
pub struct CreateMaterialPayload {
    pub name_key: String,
    pub description_key: Option<String>,
    pub sku: Option<String>,
    pub unit_of_measure: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct AssetDetail {
    pub id: Uuid,
    pub name: String,
    pub model_number: Option<String>,
    pub serial_number: Option<String>, 
    pub status: AssetStatus,
    pub purchase_date: Option<NaiveDate>,
    pub warranty_until: Option<NaiveDate>, 
    pub price_in_cents: i32,               
    pub type_name: Option<String>,         
    pub base_name: Option<String>,         
    pub base_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct AssetQuery {
    pub base_id: Option<Uuid>,
    pub status: Option<String>,
    pub keyword: Option<String>, 
}

#[derive(Debug, Serialize, FromRow)]
pub struct AssetType {
    pub id: Uuid,
    pub hq_id: Uuid,
    pub name_key: String,
    pub description_key: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAssetTypePayload {
    pub name_key: String,
    pub description_key: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Asset {
    pub id: Uuid,
    pub hq_id: Uuid,
    pub base_id: Option<Uuid>,
    pub asset_type_id: Option<Uuid>,
    pub name: String,
    pub model_number: Option<String>,
    pub status: AssetStatus, 
    pub purchase_date: Option<NaiveDate>,
    pub serial_number: Option<String>,
    pub price_in_cents: i32,
    pub warranty_until: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAssetPayload {
    pub base_id: Option<Uuid>,
    pub asset_type_id: Option<Uuid>,
    pub name: String,
    pub model_number: Option<String>,
    pub status: Option<AssetStatus>,
    pub purchase_date: Option<NaiveDate>,
    pub serial_number: Option<String>,
    pub price: Option<f64>,
    pub warranty_until: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct TransferAssetPayload {
    pub target_base_id: Uuid,
}

// ==========================================
// 6. 客户与会员 (CRM)
// ==========================================

#[derive(Debug, Serialize, FromRow)]
pub struct Customer {
    pub id: Uuid,
    pub hq_id: Uuid,
    pub base_id: Option<Uuid>,
    pub name: Option<String>,
    pub phone_number: String,
    pub wechat_openid: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCustomerPayload {
    pub name: Option<String>,
    pub phone_number: String,
    pub base_id: Option<Uuid>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Participant {
    pub id: Uuid,
    pub hq_id: Uuid,
    pub customer_id: Uuid,
    pub name: String,
    pub date_of_birth: Option<chrono::NaiveDate>,
    pub gender: Option<String>,
    pub school_name: Option<String>,
    pub notes: Option<String>,
    pub avatar_url: Option<String>
}

#[derive(Debug, Deserialize)]
pub struct CreateParticipantPayload {
    pub customer_id: Uuid,
    pub name: String,
    pub date_of_birth: Option<chrono::NaiveDate>,
    pub gender: Option<String>,
    pub school_name: Option<String>,
    pub notes: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ParticipantDetail {
    pub id: Uuid,
    pub name: String,
    pub date_of_birth: Option<chrono::NaiveDate>,
    pub gender: Option<String>,
    pub customer_name: Option<String>,
    pub customer_phone: String,
    pub current_total_points: Option<i32>,
    pub rank_name_key: Option<String>,
    pub base_id: Option<Uuid>,   
    pub base_name: Option<String>,
    pub last_class_time: Option<chrono::DateTime<chrono::Utc>>,
    #[sqlx(default)]
    pub remaining_counts: Option<i64>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct TenantParticipantStats {
    pub total_count: i64,
    pub new_this_month: i64,
    pub active_members: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct MembershipTier {
    pub id: Uuid,
    pub hq_id: Uuid,
    pub name_key: String, 
    pub description_key: Option<String>,
    pub tier_type: MembershipTierType,
    pub price_in_cents: i32,
    pub duration_days: Option<i32>,
    pub usage_count: Option<i32>,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateMembershipTierPayload {
    pub name_key: String,
    pub description_key: Option<String>,
    pub tier_type: MembershipTierType,
    pub price: f64, 
    pub duration_days: Option<i32>,
    pub usage_count: Option<i32>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct CustomerMembership {
    pub id: Uuid,
    pub customer_id: Uuid,
    pub participant_id: Option<Uuid>, 
    pub tier_id: Uuid,
    pub hq_id: Uuid,
    pub start_date: DateTime<Utc>,
    pub expiry_date: Option<DateTime<Utc>>, 
    pub remaining_uses: Option<i32>,    
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateCustomerMembershipPayload {
    pub customer_id: Uuid,    
    pub tier_id: Uuid,        
    pub participant_id: Option<Uuid>, 
}

// ==========================================
// 7. 教务 (Course, Class)
// ==========================================

#[derive(Debug, Serialize, FromRow)]
pub struct Course {
    pub id: Uuid,
    pub hq_id: Uuid,
    pub name_key: String, 
    pub description_key: Option<String>,
    pub target_audience_key: Option<String>,
    pub default_duration_minutes: i32,
    pub points_awarded: i32, 
    pub prerequisite_course_id: Option<Uuid>, 
    pub is_active: bool,
    pub cover_url: Option<String>,
    pub introduction: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCoursePayload {
    pub name_key: String,
    pub description_key: Option<String>,
    pub target_audience_key: Option<String>,
    pub default_duration_minutes: Option<i32>,
    pub points_awarded: Option<i32>,
    pub prerequisite_course_id: Option<Uuid>,
    pub cover_url: Option<String>,
    pub introduction: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCoursePayload {
    pub name_key: String,
    pub description_key: Option<String>,
    pub target_audience_key: Option<String>,
    pub default_duration_minutes: i32,
    pub points_awarded: i32,
    pub cover_url: Option<String>,
    pub introduction: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Room {
    pub id: Uuid,
    pub hq_id: Uuid,
    pub base_id: Uuid,
    pub name: String,
    pub capacity: Option<i32>,
    pub is_schedulable: bool,
    pub layout_rows: Option<i32>,
    pub layout_columns: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRoomPayload {
    pub base_id: Uuid,
    pub name: String,
    pub capacity: Option<i32>,
    pub layout_rows: Option<i32>,
    pub layout_columns: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRoomPayload {
    pub name: String,
    pub capacity: i32,
    pub layout_rows: i32,
    pub layout_columns: i32,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Class {
    pub id: Uuid,
    pub hq_id: Uuid,
    pub base_id: Uuid,
    pub course_id: Uuid,
    pub room_id: Uuid,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub max_capacity: i32,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateClassPayload {
    pub course_id: Uuid,
    pub teacher_ids: Vec<Uuid>,
    pub room_id: Uuid,
    pub start_time: DateTime<Utc>, 
    pub end_time: DateTime<Utc>,   
    pub max_capacity: i32,
    pub recurrence_type: Option<String>,
    pub repeat_count: Option<i32>,       
}

#[derive(Debug, Serialize, FromRow)]
pub struct ClassDetail {
    pub id: Uuid,
    pub hq_id: Uuid,
    pub base_id: Uuid,
    pub course_id: Uuid,
    pub room_id: Uuid,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub max_capacity: i32,
    pub status: Option<String>,
    pub course_name_key: String, 
    pub teacher_names: Option<String>,
    pub room_name: String,
    pub room_rows: Option<i32>,
    pub room_columns: Option<i32>,  
}

#[derive(Debug, Serialize, FromRow)]
pub struct ClassEnrollment {
    pub id: Uuid,
    pub hq_id: Uuid,
    pub class_id: Uuid,
    pub participant_id: Uuid,
    pub customer_id: Uuid,
    pub customer_membership_id: Option<Uuid>,
    pub status: Option<String>,
    pub teacher_feedback: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEnrollmentPayload {
    pub class_id: Uuid,
    pub participant_id: Uuid,
    pub customer_membership_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEnrollmentPayload {
    pub status: String,
    pub teacher_feedback: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct EnrollmentDetail {
    pub id: Uuid,
    pub hq_id: Uuid,
    pub participant_id: Uuid,
    pub participant_name: String,       
    pub participant_avatar: Option<String>, 
    pub participant_gender: Option<String>, 
    pub status: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ==========================================
// 8. 运营 (Procurement, Stock)
// ==========================================

#[derive(Debug, Serialize, FromRow)]
pub struct ProcurementOrder {
    pub id: Uuid,
    pub hq_id: Uuid,
    pub base_id: Uuid,
    pub base_name: Option<String>, 
    pub applicant_name: Option<String>, 
    pub status: ProcurementStatus,
    pub submit_note: Option<String>,
    pub reject_reason: Option<String>,
    pub logistics_company: Option<String>,
    pub tracking_number: Option<String>, 
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ProcurementItem {
    pub id: Uuid,
    pub material_id: Uuid,
    pub material_name: String, 
    pub unit: Option<String>,
    pub quantity: i32,
}

#[derive(Debug, Deserialize)]
pub struct CreateProcurementPayload {
    pub submit_note: Option<String>,
    pub items: Vec<CreateProcurementItemPayload>,
}

#[derive(Debug, Deserialize)]
pub struct CreateProcurementItemPayload {
    pub material_id: Uuid,
    pub quantity: i32,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProcurementStatusPayload {
    pub status: ProcurementStatus,
    pub reject_reason: Option<String>,
    pub logistics_company: Option<String>,
    pub tracking_number: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct StockAlert {
    pub material_id: Uuid,
    pub name_key: String, 
    pub current_stock: i64, 
}

// ==========================================
// 9. 智能排课 (AI)
// ==========================================

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct TeacherSkill {
    pub course_id: Uuid,
    pub course_name: Option<String>, 
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct TeacherAvailability {
    pub id: Uuid,
    pub teacher_id: Uuid,
    pub day_of_week: i32, 
    pub start_time: chrono::NaiveTime,
    pub end_time: chrono::NaiveTime,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTeacherSkillsPayload {
    pub course_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAvailabilityPayload {
    pub day_of_week: i32,
    pub start_time: String, 
    pub end_time: String,   
}

#[derive(Debug, Serialize)]
pub struct AutoScheduleRequest {
    pub start_date: chrono::NaiveDate,
    pub end_date: chrono::NaiveDate,
    pub hq_id: Uuid,
    pub base_id: Uuid,
}

// ==========================================
// 10. 财务中心 (Finance) - V25.7 修复版
// ========================================== 
#[derive(Debug, Serialize, FromRow)]
pub struct OrderDetail {
    pub id: Uuid,
    pub order_no: String,
    #[serde(rename = "type")] 
    pub type_: String, 
    pub status: String,
    pub customer_name: Option<String>,
    pub contact_name: Option<String>,
    
    pub event_date: Option<chrono::NaiveDate>,
    #[sqlx(default)]
    pub expected_attendees: i32,

    pub total_amount_cents: i32,
    pub paid_amount_cents: i32,
    pub created_at: DateTime<Utc>,
    #[sqlx(default)]
    pub payment_status: Option<String>,
    
    // ★★★ 新增字段 ★★★
    #[sqlx(default)]
    pub sales_name: Option<String>, 
    #[sqlx(default)]
    pub invoice_status: Option<String>, 
    pub contract_url: Option<String>,   
}

#[derive(Debug, Serialize, FromRow)]
pub struct OrderItem {
    pub id: Uuid,
    pub name: String,
    pub quantity: i32,
    pub unit_price_cents: i32,
    pub total_price_cents: i32,
}

#[derive(Debug, Deserialize)]
pub struct CreateOrderPayload {
    pub type_: OrderType, // 使用 Enum
    pub customer_id: Option<Uuid>,
    pub contact_name: String,
    
    // ★ 修复：全部设为 Option，适配后端逻辑
    pub total_amount: Option<f64>, 
    pub event_date: Option<NaiveDate>,
    pub expected_attendees: Option<i32>,
    
    pub sales_id: Option<Uuid>,     
    pub items: Option<Vec<CreateOrderItemPayload>>, 
    pub contract_url: Option<String>, 
}

#[derive(Debug, Deserialize)]
pub struct CreateOrderItemPayload {
    pub name: String,
    pub quantity: i32,
    pub unit_price: f64, 
}

#[derive(Debug, Deserialize)]
pub struct UpdateInvoiceStatusPayload {
    pub status: String, 
}

#[derive(Debug, Deserialize)]
pub struct UpdateOrderPayload {
    pub event_date: Option<chrono::NaiveDate>,
    pub expected_attendees: Option<i32>,
    pub total_amount: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct CancelOrderPayload {
    pub reason: String,
    pub proof_url: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Expense {
    pub id: Uuid,
    pub base_id: Uuid,
    pub category: String, 
    pub amount_cents: i32,
    pub description: Option<String>,
    pub expense_date: chrono::NaiveDate,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateExpensePayload {
    pub category: String,
    pub amount: f64, 
    pub description: String,
    pub date: chrono::NaiveDate,
}

#[derive(Debug, Serialize, FromRow)]
pub struct FinancePaymentRecord {
    pub id: Uuid,
    pub order_id: Uuid,
    pub transaction_type: String, 
    pub channel: String,
    pub amount_cents: i32,
    pub payer_name: Option<String>,
    pub proof_image_url: Option<String>,
    pub status: String, 
    pub created_at: DateTime<Utc>,
}

// ★ 修复：统一使用 SubmitPaymentProofPayload
#[derive(Debug, Deserialize, Serialize)]
pub struct SubmitPaymentProofPayload {
    pub order_id: Uuid,
    pub amount: f64, 
    pub channel: String,
    pub payer_name: String,
    pub proof_url: Option<String>,
}

#[derive(Deserialize)]
pub struct PaymentQuery {
    pub status: Option<String>,
}

// ==========================================
// 11. 看板统计 (Dashboard)
// ==========================================

#[derive(Debug, Serialize, FromRow)]
pub struct DashboardStats {
    pub total_bases: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct BaseDashboardStats {
    pub participant_count: i64, 
    pub member_count: i64,
    pub today_class_count: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct AdvancedDashboardStats {
    pub trial_class_count: i64,      
    pub new_leads_count: i64,        
    pub new_members_count: i64,      
    pub conversion_rate: f64,        
    pub active_rate: f64,            
    pub staff_pending_count: i64,    
    pub staff_total_count: i64,      
}

#[derive(Debug, Serialize, FromRow)]
pub struct PendingStaff {
    pub full_name: String,
    pub role_name: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct VerifyPaymentPayload {
    pub payment_record_id: Uuid,
    pub action: String, 
}

#[derive(Debug, Serialize, FromRow)]
pub struct PendingPaymentRecord {
    pub id: Uuid,
    pub order_id: Uuid,
    pub order_no: String,        
    pub customer_name: String,   
    pub sales_name: Option<String>,
    pub payer_name: Option<String>,
    pub amount_cents: i32,
    pub channel: String,
    pub proof_image_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct OrderQueryParams {
    pub base_id: Option<Uuid>,
    pub status: Option<String>,
    pub id: Option<Uuid>, 
}

//总部-基地采购

// --- 1. 总部商品 (HQ Product) ---
#[derive(Debug, Serialize, FromRow)]
pub struct HqProduct {
    pub id: Uuid,
    pub name: String,
    pub sku: Option<String>,
    #[sqlx(rename = "type")]
    pub type_: String, // material, service
    pub price_cents: i32,
    pub stock_quantity: i32,
    pub image_url: Option<String>,
    pub is_active: bool,
}

// --- 2. 供应链订单 (Supply Order) ---
#[derive(Debug, Serialize, FromRow)]
pub struct SupplyOrder {
    pub id: Uuid,
    pub order_no: String,
    pub base_id: Uuid,
    pub base_name: Option<String>, // 连表查询用
    pub total_amount_cents: i32,
    pub status: String, // pending_payment, paid, shipped, completed
    pub payment_proof_url: Option<String>,
    pub logistics_info: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    
    // 用于列表展示的摘要信息 (PostgreSQL ARRAY_AGG 或 简单拼接)
    #[sqlx(default)]
    pub items_summary: Option<String>, 
}

// --- 3. 请求 Payload ---

// 创建订单 Payload
#[derive(Debug, Deserialize)]
pub struct CreateSupplyOrderPayload {
    pub items: Vec<SupplyOrderItemPayload>,
}

#[derive(Debug, Deserialize)]
pub struct SupplyOrderItemPayload {
    pub product_id: Uuid,
    pub quantity: i32,
}

// 上传凭证 Payload
#[derive(Debug, Deserialize)]
pub struct UploadPaymentProofPayload {
    pub proof_url: String,
}

// 总部发货 Payload
#[derive(Debug, Deserialize)]
pub struct ShipOrderPayload {
    pub logistics_info: String, // 快递单号等
}

#[derive(Debug, Deserialize)]
pub struct CreateProductPayload {
    pub name: String,
    pub sku: Option<String>,
    #[serde(rename = "type")]
    pub type_: String, // material, service
    pub price_cents: i32,
    pub stock_quantity: i32,
    pub image_url: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProductPayload {
    pub name: Option<String>,
    pub sku: Option<String>,
    #[serde(rename = "type")]
    pub type_: Option<String>,
    pub price_cents: Option<i32>,
    pub stock_quantity: Option<i32>,
    pub image_url: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ConsumeInventoryPayload {
    pub quantity: i32,
    pub reason: String,
}

// ==========================================
// 12. 财务看板数据结构 (Finance Dashboard)
// ==========================================

#[derive(Debug, Serialize)]
pub struct HqFinanceDashboardData {
    // 核心指标
    pub total_prepaid_pool: i64,      // 资金池 (分)
    pub month_cash_in: i64,           // 本月现金收入 (分)
    pub month_revenue: i64,           // 本月确认营收 (分)
    pub month_cost: i64,              // 本月总支出 (分)
    
    // 趋势图数据 (最近6个月)
    pub trend_labels: Vec<String>,    // ["8月", "9月", ...]
    pub trend_cash_in: Vec<i64>,      // 现金流
    pub trend_revenue: Vec<i64>,      // 营收
    pub trend_cost: Vec<i64>,         // 支出

    // 构成分析 (饼图)
    pub income_composition: Vec<CompositionItem>,

    // 排行榜
    pub base_rankings: Vec<BaseRankingItem>,
}

#[derive(Debug, Serialize)]
pub struct CompositionItem {
    pub name: String,
    pub value: i32, // 百分比
    pub color: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BaseRankingItem {
    pub base_id: Uuid,
    pub base_name: String,
    pub total_income: Option<i64>, // 允许为空
    #[sqlx(skip)] // 数据库不直接返回，手动计算
    pub profit_margin: f64,
}

// ==========================================
// 14. 基地运营驾驶舱 (Base Dashboard V2.0)
// ==========================================

#[derive(Debug, Serialize)]
pub struct BaseDashboardFullData {
    // --- 核心 KPI ---
    pub month_revenue: i64,          // 本月确认营收 (分)
    pub revenue_growth: f64,         // 营收环比 (0.15 = 15%)
    pub month_headcount: i64,        // ★ 本月接待总人数 (重点新增)
    pub headcount_growth: f64,       // ★ 人数环比
    pub pending_payment_amount: i64, // ★ 待回款金额 (应收账款)
    pub pending_alerts: i64,         // 待办/预警总数

    // --- 图表数据 ---
    pub trend_labels: Vec<String>,   // X轴: ["W1", "W2"...]
    pub trend_headcount: Vec<i64>,   // Y轴: 接待人数
    pub trend_revenue: Vec<i64>,     // Y轴: 营收趋势

    // --- 构成分析 ---
    pub customer_composition: Vec<CompositionItem>, 

    // --- 运营日程 ---
    pub upcoming_events: Vec<UpcomingEventItem>,
    pub todo_list: Vec<DashboardTodoItem>,
}

#[derive(Debug, Serialize)]
pub struct DashboardTodoItem {
    pub id: String,
    pub title: String,
    pub tag: String,       // "采购", "库存", "财务"
    pub tag_color: String, // "blue", "red", "orange"
    pub date: String,
}

#[derive(Debug, Serialize)]
pub struct UpcomingEventItem {
    pub date: String,
    pub customer_name: String,
    pub type_name: String, // "团建", "党建"
    pub headcount: i32,
    pub status: String,
}