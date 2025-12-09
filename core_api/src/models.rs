/*
 * core_api/src/models.rs
 * (★ V16.6 - 终极完整版: 包含财务 + 资产实物枚举 + CRM增强 + 课程营销 ★)
 */
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, NaiveDate, Utc};

// ==========================================
// 基础枚举定义
// ==========================================

#[derive(Debug, Serialize, Deserialize, sqlx::Type, PartialEq, Eq, Clone, Copy)]
#[sqlx(type_name = "membership_tier_type", rename_all = "snake_case")]          
#[serde(rename_all = "snake_case")]
pub enum MembershipTierType {
    TimeBased,
    UsageBased,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type, PartialEq, Eq, Clone, Copy)]
#[sqlx(type_name = "asset_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AssetStatus {
    InStock,
    InUse,
    InClass,
    InMaintenance,
    Retired,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type, PartialEq, Eq, Clone, Copy)]
#[sqlx(type_name = "procurement_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ProcurementStatus {
    Pending,  // 待审批
    Approved, // 已批准
    Rejected, // 已拒绝
    Shipped,  // 已发货
    Received, // 已收货
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type, PartialEq, Eq, Clone, Copy)]
#[sqlx(type_name = "transaction_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TransactionType {
    Income,
    Expense,
    Refund,
    Usage,
    Adjustment,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type, PartialEq, Eq, Clone, Copy)]
#[sqlx(type_name = "transaction_category", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TransactionCategory {
    MembershipSale,
    ProcurementCost,
    CourseRevenue,
    Salary,
    Utility,
    Rent,
    Other,
}

// ==========================================
// 基础资源 (Base, Tenant, Common)
// ==========================================

#[derive(Debug, Serialize, FromRow)]
pub struct Tenant {
    pub id: Uuid,
    pub name: String,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Base {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String, 
    pub address: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBasePayload {
    pub name: String,
    pub address: Option<String>,
}

// 通用状态更新 Payload (上下架)
#[derive(Debug, Deserialize)]
pub struct UpdateStatusPayload {
    pub is_active: bool,
}

// ==========================================
// 用户与权限 (User, Teacher, Honor)
// ==========================================

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
    
    #[serde(skip_serializing_if = "Option::is_none")]
    #[sqlx(default)] 
    pub initial_password: Option<String>,

    // V13.1 新增: 技能与状态
    #[sqlx(default)]
    pub skills: Option<String>, 
    #[sqlx(default)]
    pub is_teaching_now: Option<bool>, 
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
    pub tenant_id: Uuid,
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
    pub tenant_id: Uuid,
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
// 资产与物料 (Asset, Material) - V16.4+
// ==========================================

#[derive(Debug, Serialize, FromRow)]
pub struct Material {
    pub id: Uuid,
    pub tenant_id: Uuid,
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
    
    pub status: AssetStatus, // (注意: 这里使用了 AssetStatus 枚举)
    
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
    pub status: Option<String>, // (查询参数通常保持 String 以便处理 "all" 或非法值)
    pub keyword: Option<String>, 
}

#[derive(Debug, Serialize, FromRow)]
pub struct AssetType {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name_key: String,
    pub description_key: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAssetTypePayload {
    pub name_key: String,
    pub description_key: Option<String>,
}

// 资产实物 (V16.6 Enums)
#[derive(Debug, Serialize, FromRow)]
pub struct Asset {
    pub id: Uuid,
    pub tenant_id: Uuid,
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
// 会员与客户 (CRM, Membership)
// ==========================================

#[derive(Debug, Serialize, FromRow)]
pub struct Customer {
    pub id: Uuid,
    pub tenant_id: Uuid,
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
    pub tenant_id: Uuid,
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

// 学员详情视图 (V16.3)
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

// 学员统计 (V16.2)
#[derive(Debug, Serialize, FromRow)]
pub struct TenantParticipantStats {
    pub total_count: i64,
    pub new_this_month: i64,
    pub active_members: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct MembershipTier {
    pub id: Uuid,
    pub tenant_id: Uuid,
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
    pub tenant_id: Uuid,
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
// 教务与排课 (Course, Class, Schedule)
// ==========================================

// 课程 (V16.1 营销版)
#[derive(Debug, Serialize, FromRow)]
pub struct Course {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name_key: String, 
    pub description_key: Option<String>,
    pub target_audience_key: Option<String>,
    pub default_duration_minutes: i32,
    pub points_awarded: i32, 
    pub prerequisite_course_id: Option<Uuid>, 
    pub is_active: bool,
    pub cover_url: Option<String>,    // V16.1
    pub introduction: Option<String>, // V16.1
}

#[derive(Debug, Deserialize)]
pub struct CreateCoursePayload {
    pub name_key: String,
    pub description_key: Option<String>,
    pub target_audience_key: Option<String>,
    pub default_duration_minutes: Option<i32>,
    pub points_awarded: Option<i32>,
    pub prerequisite_course_id: Option<Uuid>,
    pub cover_url: Option<String>,    // V16.1
    pub introduction: Option<String>, // V16.1
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

// 教室 (V12.0 布局版)
#[derive(Debug, Serialize, FromRow)]
pub struct Room {
    pub id: Uuid,
    pub tenant_id: Uuid,
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

// 排课 Class
#[derive(Debug, Serialize, FromRow)]
pub struct Class {
    pub id: Uuid,
    pub tenant_id: Uuid,
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
    pub tenant_id: Uuid,
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
    pub tenant_id: Uuid,
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

// 报名详情 (花名册)
#[derive(Debug, Serialize, FromRow)]
pub struct EnrollmentDetail {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub participant_id: Uuid,
    pub participant_name: String,       
    pub participant_avatar: Option<String>, 
    pub participant_gender: Option<String>, 
    pub status: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ==========================================
// 运营: 采购与库存 (Procurement, Stock)
// ==========================================

#[derive(Debug, Serialize, FromRow)]
pub struct ProcurementOrder {
    pub id: Uuid,
    pub tenant_id: Uuid,
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
// 智能排课 (AI & Teacher Config)
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
    pub tenant_id: Uuid,
    pub base_id: Uuid,
}

// ==========================================
// 财务中心 (Finance) - V15.0
// ==========================================

#[derive(Debug, Serialize, FromRow)]
pub struct FinancialTransaction {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub base_id: Option<Uuid>,
    pub amount_in_cents: i32,
    pub transaction_type: TransactionType,
    pub category: TransactionCategory,
    pub related_entity_id: Option<Uuid>,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub base_name: Option<String>,
    pub created_by_name: Option<String>, 
}

#[derive(Debug, Deserialize)]
pub struct CreateTransactionPayload {
    pub base_id: Option<Uuid>,
    pub amount: f64, 
    pub transaction_type: TransactionType,
    pub category: TransactionCategory,
    pub description: String,
}

// ==========================================
// 看板 (Dashboard)
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