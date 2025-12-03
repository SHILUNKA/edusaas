/*
 * core_api/src/models.rs
 * (★ V6.0 - 终极完整版: 包含用户档案 + 军衔 + 采购 + 库存 ★)
 */
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, NaiveDate, Utc};

#[derive(Debug, Serialize, Deserialize, sqlx::Type, PartialEq, Eq, Clone, Copy)]
#[sqlx(type_name = "membership_tier_type", rename_all = "snake_case")]          
#[serde(rename_all = "snake_case")]
pub enum MembershipTierType {
    TimeBased,
    UsageBased,
}

// --- 租户 ---
#[derive(Debug, Serialize, FromRow)]
pub struct Tenant {
    pub id: Uuid,
    pub name: String,
}

// --- 荣誉军衔 ---
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

// --- 基地 ---
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

// --- 物料 ---
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

// --- 资产类型 ---
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

// --- 会员卡种 ---
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

// --- 课程 ---
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
}

#[derive(Debug, Deserialize)]
pub struct CreateCoursePayload {
    pub name_key: String,
    pub description_key: Option<String>,
    pub target_audience_key: Option<String>,
    pub default_duration_minutes: Option<i32>,
    pub points_awarded: Option<i32>,
    pub prerequisite_course_id: Option<Uuid>,
}

// --- 看板 ---
#[derive(Debug, Serialize, FromRow)]
pub struct DashboardStats {
    pub total_bases: i64,
}

// --- 学员总览 ---
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
    pub base_name: Option<String>, 
}

// --- 分店/教室/排课 ---
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
    pub start_time: DateTime<Utc>, // 第一节课开始时间
    pub end_time: DateTime<Utc>,   // 第一节课结束时间
    pub max_capacity: i32,
    
    // (★ 新增字段: 重复规则)
    pub recurrence_type: Option<String>, // "none" | "weekly" | "biweekly"
    pub repeat_count: Option<i32>,       // 重复次数 (例如 10节)
}

#[derive(Debug, Deserialize)]
pub struct CreateRoomPayload {
    pub base_id: Uuid,
    pub name: String,
    pub capacity: Option<i32>,
    pub layout_rows: Option<i32>,
    pub layout_columns: Option<i32>,
}

// --- Customer ---
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

// --- Participant ---
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

#[derive(Debug, Serialize, FromRow)]
pub struct EnrollmentDetail {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub participant_id: Uuid,
    pub participant_name: String,       // (JOIN participants.name)
    pub participant_avatar: Option<String>, // (JOIN participants.avatar_url)
    pub participant_gender: Option<String>, // (JOIN participants.gender)
    pub status: Option<String>,
    pub created_at: DateTime<Utc>,
}

// --- ClassEnrollment ---
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

// --- CustomerMembership ---
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

// --- Base Dashboard ---
#[derive(Debug, Serialize, FromRow)]
pub struct BaseDashboardStats {
    pub participant_count: i64, 
    pub member_count: i64,
    pub today_class_count: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct StockAlert {
    pub material_id: Uuid,
    pub name_key: String, 
    pub current_stock: i64, 
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

// --- User ---
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

    #[sqlx(default)]
    pub skills: Option<String>, // 逗号分隔的技能名
    #[sqlx(default)]
    pub is_teaching_now: Option<bool>, // 当前是否正在上课
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
}

// --- 【新增】Phase 5: 采购 (Procurement) ---

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

// 采购单详情
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
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// 采购单明细
#[derive(Debug, Serialize, FromRow)]
pub struct ProcurementItem {
    pub id: Uuid,
    pub material_id: Uuid,
    pub material_name: String, 
    pub unit: Option<String>,
    pub quantity: i32,
}

// [请求] 创建采购单
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

// [请求] 更新状态
#[derive(Debug, Deserialize)]
pub struct UpdateProcurementStatusPayload {
    pub status: ProcurementStatus,
    pub reject_reason: Option<String>,
}

// --- 【新增】Phase 6: 教师排课配置 (Schedule AI) ---

// 1. 老师技能 (可教课程)
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct TeacherSkill {
    pub course_id: Uuid,
    // 前端展示用
    pub course_name: Option<String>, 
}

// 2. 老师可用时间 (Availability)
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct TeacherAvailability {
    pub id: Uuid,
    pub teacher_id: Uuid,
    pub day_of_week: i32, // 1-7
    pub start_time: chrono::NaiveTime,
    pub end_time: chrono::NaiveTime,
}

// 3. [请求] 更新技能 (批量覆盖)
#[derive(Debug, Deserialize)]
pub struct UpdateTeacherSkillsPayload {
    pub course_ids: Vec<Uuid>,
}

// 4. [请求] 新增时间段
#[derive(Debug, Deserialize)]
pub struct CreateAvailabilityPayload {
    pub day_of_week: i32,
    pub start_time: String, // "09:00"
    pub end_time: String,   // "12:00"
}

// 发送给 AI 的排课请求结构
#[derive(Debug, Serialize)]
pub struct AutoScheduleRequest {
    pub start_date: chrono::NaiveDate, // 排哪一周
    pub end_date: chrono::NaiveDate,
    pub tenant_id: Uuid,
    pub base_id: Uuid,
}

// --- Phase 7: 财务中心 (Financial Center) ---

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
    
    // (用于前端展示的 JOIN 字段)
    pub base_name: Option<String>,       // JOIN bases
    pub created_by_name: Option<String>, // JOIN users
}

// [请求] 手动录入流水 (例如: 录入水电费)
#[derive(Debug, Deserialize)]
pub struct CreateTransactionPayload {
    pub base_id: Option<Uuid>,
    pub amount: f64, // 前端传元 (100.00)
    pub transaction_type: TransactionType,
    pub category: TransactionCategory,
    pub description: String,
}