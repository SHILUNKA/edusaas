/*
====================================================================
--- 数据库初始化脚本 (V5.0 - 完整功能版) ---
--- 包含: 员工档案增强、集采流程、19级军衔体系 ---
====================================================================
*/

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

/*
====================================================================
--- Phase 0: SaaS 基础 (租户, B端员工, 角色) ---
====================================================================
*/

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL, -- 品牌名 (例如 "星澜天物")
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, -- 基地名 (例如 "北京朝阳基地")
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    base_id UUID REFERENCES bases(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    
    -- (★ V5.0 新增: 详细档案字段)
    phone_number VARCHAR(50),
    gender VARCHAR(20),
    blood_type VARCHAR(10),
    date_of_birth DATE,
    address TEXT,
    password_changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- (密码过期策略)

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name_key VARCHAR(100) NOT NULL, -- 例如 "role.tenant.admin"
    description_key TEXT, 
    UNIQUE(tenant_id, name_key)
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

/*
====================================================================
--- Phase 1: 资产与物料模块 ---
====================================================================
*/

CREATE TYPE asset_status AS ENUM (
    'in_stock', 'in_use', 'in_class', 'in_maintenance', 'retired'
);

CREATE TABLE asset_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name_key VARCHAR(255) NOT NULL, 
    description_key TEXT,
    UNIQUE(tenant_id, name_key)
);

CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    base_id UUID REFERENCES bases(id),
    asset_type_id UUID REFERENCES asset_types(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL, 
    model_number VARCHAR(100),
    status asset_status DEFAULT 'in_stock',
    purchase_date DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name_key VARCHAR(255) NOT NULL, 
    description_key TEXT, 
    sku VARCHAR(100),
    unit_of_measure VARCHAR(50) DEFAULT '个', 
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE material_stock_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    base_id UUID NOT NULL REFERENCES bases(id),
    change_amount INT NOT NULL,
    reason_key VARCHAR(255) NOT NULL, 
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

/*
====================================================================
--- Phase 1: 会员 (Customer) 系统 ---
====================================================================
*/

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    base_id UUID REFERENCES bases(id),
    name VARCHAR(255), 
    phone_number VARCHAR(50) NOT NULL,
    wechat_openid VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, phone_number)
);

CREATE TABLE participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, 
    date_of_birth DATE,
    gender VARCHAR(50),
    school_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE membership_tier_type AS ENUM (
    'time_based', 'usage_based'
);

CREATE TABLE membership_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name_key VARCHAR(255) NOT NULL, 
    description_key TEXT, 
    tier_type membership_tier_type NOT NULL DEFAULT 'time_based',
    price_in_cents INT NOT NULL DEFAULT 0,
    duration_days INT,
    usage_count INT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customer_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES membership_tiers(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    start_date TIMESTAMPTZ NOT NULL,
    expiry_date TIMESTAMPTZ,
    remaining_uses INT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE honor_ranks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name_key VARCHAR(100) NOT NULL, 
    rank_level INT NOT NULL,
    points_required INT NOT NULL DEFAULT 0,
    badge_icon_url TEXT,
    UNIQUE(tenant_id, rank_level),
    UNIQUE(tenant_id, name_key)
);

CREATE TABLE participant_profiles (
    participant_id UUID PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    current_total_points INT NOT NULL DEFAULT 0,
    current_honor_rank_id UUID REFERENCES honor_ranks(id),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE point_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    points_change INT NOT NULL,
    reason_key VARCHAR(255) NOT NULL, 
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

/*
====================================================================
--- Phase 2: 教务 (教师, 课程, 排课) ---
====================================================================
*/

CREATE TABLE teachers (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    base_id UUID REFERENCES bases(id),
    bio TEXT, 
    specialization TEXT, 
    qualifications TEXT, 
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    base_id UUID NOT NULL REFERENCES bases(id),
    name VARCHAR(100) NOT NULL, 
    capacity INT DEFAULT 10,
    is_schedulable BOOLEAN DEFAULT true
);

CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name_key VARCHAR(255) NOT NULL, 
    description_key TEXT, 
    target_audience_key VARCHAR(100), 
    default_duration_minutes INT NOT NULL DEFAULT 60,
    points_awarded INT NOT NULL DEFAULT 0,
    prerequisite_course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE course_required_materials (
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    quantity_required INT NOT NULL DEFAULT 1,
    PRIMARY KEY (course_id, material_id)
);

CREATE TABLE course_required_asset_types (
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    asset_type_id UUID NOT NULL REFERENCES asset_types(id) ON DELETE CASCADE,
    quantity_required INT NOT NULL DEFAULT 1,
    PRIMARY KEY (course_id, asset_type_id)
);

CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    base_id UUID NOT NULL REFERENCES bases(id),
    course_id UUID NOT NULL REFERENCES courses(id),
    teacher_id UUID NOT NULL REFERENCES teachers(user_id),
    room_id UUID NOT NULL REFERENCES rooms(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    max_capacity INT NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled'
);

CREATE TABLE class_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'enrolled',
    teacher_feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(class_id, participant_id)
);

/*
====================================================================
--- Phase 5: 采购与供应链 (Procurement) - (★ 新增模块) ---
====================================================================
*/

CREATE TYPE procurement_status AS ENUM ('pending', 'approved', 'rejected', 'shipped', 'received');

CREATE TABLE procurement_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
    applicant_id UUID REFERENCES users(id),
    status procurement_status DEFAULT 'pending',
    submit_note TEXT, 
    reject_reason TEXT, 
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE procurement_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES procurement_orders(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id),
    quantity INT NOT NULL, 
    check (quantity > 0)
);

/*
====================================================================
--- Phase 1: B端员工 登录日志 ---
====================================================================
*/

CREATE TYPE login_status AS ENUM (
    'success',
    'failed'
);

CREATE TABLE user_login_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_attempted VARCHAR(255) NOT NULL, 
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, 
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    login_timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(100),
    user_agent TEXT,
    status login_status NOT NULL,
    failure_reason_key VARCHAR(255) 
);

/*
====================================================================
--- 索引区 ---
====================================================================
*/

-- Phase 1 资产索引
CREATE INDEX idx_assets_tenant_base ON assets (tenant_id, base_id);
CREATE INDEX idx_assets_type ON assets (asset_type_id);
CREATE INDEX idx_materials_tenant ON materials (tenant_id);
CREATE INDEX idx_material_stock_changes_material_base ON material_stock_changes (material_id, base_id);

-- Phase 1 会员索引
CREATE INDEX idx_customers_tenant_phone ON customers (tenant_id, phone_number);
CREATE INDEX idx_participants_customer ON participants (customer_id);
CREATE INDEX idx_membership_tiers_tenant ON membership_tiers (tenant_id);
CREATE INDEX idx_customer_memberships_customer ON customer_memberships (customer_id);
CREATE INDEX idx_customer_memberships_participant ON customer_memberships (participant_id);
CREATE INDEX idx_honor_ranks_tenant_level ON honor_ranks (tenant_id, rank_level);
CREATE INDEX idx_point_transactions_participant ON point_transactions (participant_id);

-- Phase 2 教务索引
CREATE INDEX idx_teachers_tenant_base ON teachers (tenant_id, base_id);
CREATE INDEX idx_rooms_tenant_base ON rooms (tenant_id, base_id);
CREATE INDEX idx_courses_tenant ON courses (tenant_id);
CREATE INDEX idx_classes_tenant_base ON classes (tenant_id, base_id);
CREATE INDEX idx_classes_time_teacher_room ON classes (start_time, end_time, teacher_id, room_id);
CREATE INDEX idx_class_enrollments_class ON class_enrollments (class_id);
CREATE INDEX idx_class_enrollments_participant ON class_enrollments (participant_id);

-- Phase 5 采购索引 (★ 新增)
CREATE INDEX idx_procurement_orders_tenant ON procurement_orders(tenant_id);
CREATE INDEX idx_procurement_orders_base ON procurement_orders(base_id);
CREATE INDEX idx_procurement_orders_status ON procurement_orders(status);

-- 登录日志索引
CREATE INDEX idx_user_login_history_user_id ON user_login_history (user_id);
CREATE INDEX idx_user_login_history_tenant_id ON user_login_history (tenant_id);
CREATE INDEX idx_user_login_history_email ON user_login_history (email_attempted);
CREATE INDEX idx_user_login_history_timestamp ON user_login_history (login_timestamp);

/*
====================================================================
--- Seed Data: 初始数据预设 (★ 关键更新) ---
====================================================================
*/

-- 1. 创建默认测试租户 (如果不存在)
INSERT INTO tenants (name) VALUES ('默认测试品牌') ON CONFLICT DO NOTHING;

-- 2. 预设核心角色 (总部管理员, 基地校长, 普通教师)
INSERT INTO roles (tenant_id, name_key, description_key)
SELECT id, 'role.tenant.admin', '总部超级管理员' FROM tenants LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO roles (tenant_id, name_key, description_key)
SELECT id, 'role.base.admin', '分基地/校区管理员' FROM tenants LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO roles (tenant_id, name_key, description_key)
SELECT id, 'role.teacher', '普通教师/员工' FROM tenants LIMIT 1
ON CONFLICT DO NOTHING;

-- 3. 预设 19 级军衔体系
INSERT INTO honor_ranks (tenant_id, name_key, rank_level, points_required, badge_icon_url)
VALUES 
-- 士兵 & 士官
((SELECT id FROM tenants LIMIT 1), '列兵', 1, 0, NULL),
((SELECT id FROM tenants LIMIT 1), '上等兵', 2, 100, NULL),
((SELECT id FROM tenants LIMIT 1), '下士', 3, 300, NULL),
((SELECT id FROM tenants LIMIT 1), '中士', 4, 600, NULL),
((SELECT id FROM tenants LIMIT 1), '二级上士', 5, 1200, NULL),
((SELECT id FROM tenants LIMIT 1), '一级上士', 6, 2000, NULL),
((SELECT id FROM tenants LIMIT 1), '三级军士长', 7, 3500, NULL),
((SELECT id FROM tenants LIMIT 1), '二级军士长', 8, 6000, NULL),
((SELECT id FROM tenants LIMIT 1), '一级军士长', 9, 10000, NULL),
-- 尉官
((SELECT id FROM tenants LIMIT 1), '少尉', 10, 15000, NULL),
((SELECT id FROM tenants LIMIT 1), '中尉', 11, 22000, NULL),
((SELECT id FROM tenants LIMIT 1), '上尉', 12, 30000, NULL),
-- 校官
((SELECT id FROM tenants LIMIT 1), '少校', 13, 45000, NULL),
((SELECT id FROM tenants LIMIT 1), '中校', 14, 65000, NULL),
((SELECT id FROM tenants LIMIT 1), '上校', 15, 90000, NULL),
((SELECT id FROM tenants LIMIT 1), '大校', 16, 120000, NULL),
-- 将官
((SELECT id FROM tenants LIMIT 1), '少将', 17, 160000, NULL),
((SELECT id FROM tenants LIMIT 1), '中将', 18, 220000, NULL),
((SELECT id FROM tenants LIMIT 1), '上将', 19, 300000, NULL)
ON CONFLICT DO NOTHING;


/*
====================================================================
--- Phase 6: 智能排课基础 (AI Scheduling) - (★ V7.0 新增) ---
====================================================================
*/

-- 1. 老师技能表：记录老师能教哪些课 (多对多)
CREATE TABLE teacher_qualified_courses (
    teacher_id UUID NOT NULL REFERENCES teachers(user_id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    PRIMARY KEY (teacher_id, course_id)
);

-- 2. 老师可用时间表：记录每周哪些时间段有空
-- day_of_week: 1 (周一) - 7 (周日)
CREATE TABLE teacher_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES teachers(user_id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. 索引
CREATE INDEX idx_teacher_availability_tid ON teacher_availability(teacher_id);
/*
====================================================================
--- 脚本结束 ---
====================================================================
*/