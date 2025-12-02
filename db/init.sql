/*
====================================================================
--- 数据库初始化脚本 (V13.0 - 最终完整版) ---
--- 包含: 
--- 1. 基础: 租户, 基地, 员工(含详细档案), 角色
--- 2. 教务: 多师排课(class_teachers), 教室布局(layout), 课程
--- 3. 业务: CRM(家长/学员), 会员卡, 积分军衔(19级)
--- 4. 运营: 物资集采(Procurement), 库存管理
--- 5. 智能: 教师技能与时间配置(AI Scheduling)
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
    name VARCHAR(255) NOT NULL, 
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, 
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
    
    -- (V5.0+) 详细档案字段
    phone_number VARCHAR(50),
    gender VARCHAR(20),
    blood_type VARCHAR(10),
    date_of_birth DATE,
    address TEXT,
    password_changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name_key VARCHAR(100) NOT NULL, 
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

-- (V12.0+ 修改: 增加教室布局字段)
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    base_id UUID NOT NULL REFERENCES bases(id),
    name VARCHAR(100) NOT NULL, 
    capacity INT DEFAULT 10,
    is_schedulable BOOLEAN DEFAULT true,
    layout_rows INT DEFAULT 5,
    layout_columns INT DEFAULT 6
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

-- (V9.0+ 修改: 移除 teacher_id)
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    base_id UUID NOT NULL REFERENCES bases(id),
    course_id UUID NOT NULL REFERENCES courses(id),
    room_id UUID NOT NULL REFERENCES rooms(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    max_capacity INT NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled'
);

-- (V9.0+ 新增: 课程-老师关联表)
CREATE TABLE class_teachers (
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES teachers(user_id) ON DELETE CASCADE,
    PRIMARY KEY (class_id, teacher_id)
);

CREATE TABLE class_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    -- (V10.0+ 修改: 增加关联会员卡)
    customer_membership_id UUID REFERENCES customer_memberships(id),
    status VARCHAR(50) DEFAULT 'enrolled',
    teacher_feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(class_id, participant_id)
);

/*
====================================================================
--- Phase 5: 采购与供应链 (Procurement) ---
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
--- Phase 6: 智能排课基础 (AI Scheduling) ---
====================================================================
*/

CREATE TABLE teacher_qualified_courses (
    teacher_id UUID NOT NULL REFERENCES teachers(user_id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    PRIMARY KEY (teacher_id, course_id)
);

CREATE TABLE teacher_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES teachers(user_id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
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

CREATE INDEX idx_assets_tenant_base ON assets (tenant_id, base_id);
CREATE INDEX idx_assets_type ON assets (asset_type_id);
CREATE INDEX idx_materials_tenant ON materials (tenant_id);
CREATE INDEX idx_material_stock_changes_material_base ON material_stock_changes (material_id, base_id);

CREATE INDEX idx_customers_tenant_phone ON customers (tenant_id, phone_number);
CREATE INDEX idx_participants_customer ON participants (customer_id);
CREATE INDEX idx_membership_tiers_tenant ON membership_tiers (tenant_id);
CREATE INDEX idx_customer_memberships_customer ON customer_memberships (customer_id);
CREATE INDEX idx_customer_memberships_participant ON customer_memberships (participant_id);
CREATE INDEX idx_honor_ranks_tenant_level ON honor_ranks (tenant_id, rank_level);
CREATE INDEX idx_point_transactions_participant ON point_transactions (participant_id);

CREATE INDEX idx_teachers_tenant_base ON teachers (tenant_id, base_id);
CREATE INDEX idx_rooms_tenant_base ON rooms (tenant_id, base_id);
CREATE INDEX idx_courses_tenant ON courses (tenant_id);
CREATE INDEX idx_classes_tenant_base ON classes (tenant_id, base_id);

-- (V9.0+ 更新: 针对时间、教室、老师的查询优化)
CREATE INDEX idx_classes_time_room ON classes (start_time, end_time, room_id);
CREATE INDEX idx_class_teachers_teacher ON class_teachers (teacher_id);

CREATE INDEX idx_class_enrollments_class ON class_enrollments (class_id);
CREATE INDEX idx_class_enrollments_participant ON class_enrollments (participant_id);

CREATE INDEX idx_procurement_orders_tenant ON procurement_orders(tenant_id);
CREATE INDEX idx_procurement_orders_base ON procurement_orders(base_id);
CREATE INDEX idx_procurement_orders_status ON procurement_orders(status);

CREATE INDEX idx_teacher_availability_tid ON teacher_availability(teacher_id);

CREATE INDEX idx_user_login_history_user_id ON user_login_history (user_id);
CREATE INDEX idx_user_login_history_tenant_id ON user_login_history (tenant_id);
CREATE INDEX idx_user_login_history_email ON user_login_history (email_attempted);
CREATE INDEX idx_user_login_history_timestamp ON user_login_history (login_timestamp);

/*
====================================================================
--- Seed Data: 初始数据预设 ---
====================================================================
*/

INSERT INTO tenants (name) VALUES ('默认测试品牌') ON CONFLICT DO NOTHING;

INSERT INTO roles (tenant_id, name_key, description_key)
SELECT id, 'role.tenant.admin', '总部超级管理员' FROM tenants LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO roles (tenant_id, name_key, description_key)
SELECT id, 'role.base.admin', '分基地/校区管理员' FROM tenants LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO roles (tenant_id, name_key, description_key)
SELECT id, 'role.teacher', '普通教师/员工' FROM tenants LIMIT 1
ON CONFLICT DO NOTHING;

-- 预设 19 级军衔体系
INSERT INTO honor_ranks (tenant_id, name_key, rank_level, points_required, badge_icon_url)
VALUES 
((SELECT id FROM tenants LIMIT 1), '列兵', 1, 0, NULL),
((SELECT id FROM tenants LIMIT 1), '上等兵', 2, 100, NULL),
((SELECT id FROM tenants LIMIT 1), '下士', 3, 300, NULL),
((SELECT id FROM tenants LIMIT 1), '中士', 4, 600, NULL),
((SELECT id FROM tenants LIMIT 1), '二级上士', 5, 1200, NULL),
((SELECT id FROM tenants LIMIT 1), '一级上士', 6, 2000, NULL),
((SELECT id FROM tenants LIMIT 1), '三级军士长', 7, 3500, NULL),
((SELECT id FROM tenants LIMIT 1), '二级军士长', 8, 6000, NULL),
((SELECT id FROM tenants LIMIT 1), '一级军士长', 9, 10000, NULL),
((SELECT id FROM tenants LIMIT 1), '少尉', 10, 15000, NULL),
((SELECT id FROM tenants LIMIT 1), '中尉', 11, 22000, NULL),
((SELECT id FROM tenants LIMIT 1), '上尉', 12, 30000, NULL),
((SELECT id FROM tenants LIMIT 1), '少校', 13, 45000, NULL),
((SELECT id FROM tenants LIMIT 1), '中校', 14, 65000, NULL),
((SELECT id FROM tenants LIMIT 1), '上校', 15, 90000, NULL),
((SELECT id FROM tenants LIMIT 1), '大校', 16, 120000, NULL),
((SELECT id FROM tenants LIMIT 1), '少将', 17, 160000, NULL),
((SELECT id FROM tenants LIMIT 1), '中将', 18, 220000, NULL),
((SELECT id FROM tenants LIMIT 1), '上将', 19, 300000, NULL)
ON CONFLICT DO NOTHING;

/*
====================================================================
--- 脚本结束 ---
====================================================================
*/