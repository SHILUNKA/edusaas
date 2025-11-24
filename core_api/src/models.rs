/*
 * models.rs
 * (★ V3 - 已添加 CustomerMembership ★)
 */
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, sqlx::Type, PartialEq, Eq, Clone, Copy)]
#[sqlx(type_name = "membership_tier_type", rename_all = "snake_case")]          
#[serde(rename_all = "snake_case")]
pub enum MembershipTierType {
    TimeBased,
    UsageBased,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Tenant {
    pub id: Uuid,
    pub name: String,
}

#[derive(Debug, Serialize, FromRow)]
pub struct HonorRank {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name_key: String, // 【策略B】
    pub rank_level: i32,
    pub points_required: i32,
    pub badge_icon_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateHonorRankPayload {
    pub name_key: String, // 【策略B】
    pub rank_level: i32,
    pub points_required: i32,
    pub badge_icon_url: Option<String>,
}

// 对应 'bases' 数据库表
#[derive(Debug, Serialize, FromRow)]
pub struct Base {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String, // "北京朝阳基地" (实体名称, 不是 i18n key)
    pub address: Option<String>,
}

// 对应前端 '创建基地' 的JSON payload
#[derive(Debug, Deserialize)]
pub struct CreateBasePayload {
    pub name: String,
    pub address: Option<String>,
}
// 对应 'materials' 数据库表
#[derive(Debug, Serialize, FromRow)]
pub struct Material {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name_key: String, // "material.rocket_kit"
    pub description_key: Option<String>,
    pub sku: Option<String>,
    pub unit_of_measure: Option<String>, // "个", "套"
}

// 对应前端 '创建物料' 的JSON payload
#[derive(Debug, Deserialize)]
pub struct CreateMaterialPayload {
    pub name_key: String,
    pub description_key: Option<String>,
    pub sku: Option<String>,
    pub unit_of_measure: Option<String>,
}
// 对应 'asset_types' 数据库表
#[derive(Debug, Serialize, FromRow)]
pub struct AssetType {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name_key: String, // "asset.type.vr_goggle"
    pub description_key: Option<String>,
}

// 对应前端 '创建资产类型' 的JSON payload
#[derive(Debug, Deserialize)]
pub struct CreateAssetTypePayload {
    pub name_key: String,
    pub description_key: Option<String>,
}

// --- Phase 1: 会员卡种 (MembershipTier) Models ---

// 对应 'membership_tiers' 数据库表
#[derive(Debug, Serialize, FromRow)]
pub struct MembershipTier {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name_key: String, // "membership.tier.gold_year"
    pub description_key: Option<String>,
    pub tier_type: MembershipTierType, // (使用我们定义的 enum)
    pub price_in_cents: i32,
    pub duration_days: Option<i32>,
    pub usage_count: Option<i32>,
    pub is_active: bool,
}

// 对应前端 '创建会员卡种' 的JSON payload
#[derive(Debug, Deserialize)]
pub struct CreateMembershipTierPayload {
    pub name_key: String,
    pub description_key: Option<String>,
    pub tier_type: MembershipTierType,
    pub price: f64, // (前端用 f64 传入, 后端转为 int)
    pub duration_days: Option<i32>,
    pub usage_count: Option<i32>,
    pub is_active: Option<bool>,
}


// --- Phase 2: 课程 (Course) Models ---

// 对应 'courses' 数据库表
#[derive(Debug, Serialize, FromRow)]
pub struct Course {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name_key: String, // "course.rocket.101"
    pub description_key: Option<String>,
    pub target_audience_key: Option<String>,
    pub default_duration_minutes: i32,
    pub points_awarded: i32, // (关联 "荣誉军衔" 体系)
    pub prerequisite_course_id: Option<Uuid>, // (关联 "课程" 自身, 用于进阶)
    pub is_active: bool,
}

// 对应前端 '创建课程' 的JSON payload
#[derive(Debug, Deserialize)]
pub struct CreateCoursePayload {
    pub name_key: String,
    pub description_key: Option<String>,
    pub target_audience_key: Option<String>,
    pub default_duration_minutes: Option<i32>,
    pub points_awarded: Option<i32>,
    pub prerequisite_course_id: Option<Uuid>,
}

// --- Phase 3: 全局看板 (Dashboard) Models ---

#[derive(Debug, Serialize, FromRow)]
pub struct DashboardStats {
    pub total_bases: i64,
}

// --- Phase 3: 学员总览 (Participant Detail) Model ---

#[derive(Debug, Serialize, FromRow)]
pub struct ParticipantDetail {
    // --- From participants ---
    pub id: Uuid,
    pub name: String,
    pub date_of_birth: Option<chrono::NaiveDate>,
    pub gender: Option<String>,
    
    // --- From customers ---
    pub customer_name: Option<String>,
    pub customer_phone: String,
    
    // --- From participant_profiles ---
    pub current_total_points: Option<i32>,
    
    // --- From honor_ranks ---
    pub rank_name_key: Option<String>,
}


// --- Phase 4: 分店 (Base) Models ---

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
}

#[derive(Debug, Serialize, FromRow)]
pub struct Class {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub base_id: Uuid,
    pub course_id: Uuid,
    pub teacher_id: Uuid,
    pub room_id: Uuid,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub max_capacity: i32,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateClassPayload {
    pub course_id: Uuid,
    pub teacher_id: Uuid,
    pub room_id: Uuid,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub max_capacity: i32,
}

// --- Phase 4: 教室 (Room) Models ---

#[derive(Debug, Deserialize)]
pub struct CreateRoomPayload {
    pub base_id: Uuid,
    pub name: String,
    pub capacity: Option<i32>,
}

// --- Phase 1: Customer Handlers ---

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

// --- Phase 1: 学员 (Participant) Models ---

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
}

#[derive(Debug, Deserialize)]
pub struct CreateParticipantPayload {
    pub customer_id: Uuid,
    pub name: String,
    pub date_of_birth: Option<chrono::NaiveDate>,
    pub gender: Option<String>,
    pub school_name: Option<String>,
    pub notes: Option<String>,
}

// --- Phase 2: 排课报名 (ClassEnrollment) Models ---

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


// --- 【新增】Phase 1: 客户会员卡 (CustomerMembership) Models ---

// 对应 'customer_memberships' 数据库表
#[derive(Debug, Serialize, FromRow)]
pub struct CustomerMembership {
    pub id: Uuid,
    pub customer_id: Uuid,
    pub participant_id: Option<Uuid>, // (可以只绑给家长, 或指定给学员)
    pub tier_id: Uuid,
    pub tenant_id: Uuid,
    pub start_date: DateTime<Utc>,
    pub expiry_date: Option<DateTime<Utc>>, // (如果是 'time_based')
    pub remaining_uses: Option<i32>,    // (如果是 'usage_based')
    pub is_active: bool,
}

// 对应前端 '分配会员卡' 的JSON payload
#[derive(Debug, Deserialize)]
pub struct CreateCustomerMembershipPayload {
    pub customer_id: Uuid,    // (★ 关键) 必须
    pub tier_id: Uuid,        // (★ 关键) 必须
    pub participant_id: Option<Uuid>, // (可选)
}

// --- 【新增】Phase 4: 分店看板 (Base Dashboard) Models ---

// 对应 "分店看板" API 返回的聚合数据
#[derive(Debug, Serialize, FromRow)]
pub struct BaseDashboardStats {
    pub participant_count: i64, // (COUNT(*) 在 SQL 中返回 i64)
    pub member_count: i64,
    pub today_class_count: i64,
}
// --- 【新增】Phase 4: 库存警报 (Stock Alert) Model ---

// 这是一个"复合"结构体, 用于 "分店看板" 的库存警报
// 它从 'materials' 和 'material_stock_changes' 表 "JOIN" 数据
#[derive(Debug, Serialize, FromRow)]
pub struct StockAlert {
    pub material_id: Uuid,
    pub name_key: String, // (来自 materials.name_key)
    pub current_stock: i64, // (来自 SUM(change_amount), i64)
}

// --- 【新增】Phase 4: 排课详情 (Class Detail) Model ---

// 这是一个"复合"结构体, 用于 "排课列表" API
// 它从 'classes', 'users', 'rooms' 表 "JOIN" 数据
#[derive(Debug, Serialize, FromRow)]
pub struct ClassDetail {
    // --- From 'classes' table ---
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub base_id: Uuid,
    pub course_id: Uuid,
    pub teacher_id: Uuid,
    pub room_id: Uuid,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub max_capacity: i32,
    pub status: Option<String>,
    
    // --- 【新增】From JOINs ---
    pub course_name_key: String, // (来自 courses.name_key)
    pub teacher_name: Option<String>, // (来自 users.full_name)
    pub room_name: String,    // (来自 rooms.name)
}
