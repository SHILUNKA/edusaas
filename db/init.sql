/*
====================================================================
--- 数据库初始化脚本 (V3.0 - 策略B "i18n" 国际化版) ---
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
    name VARCHAR(255) NOT NULL, -- 品牌名 (例如 "星澜天物") 是实体名称, 不是 "Key"
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, -- 基地名 (例如 "北京朝阳基地") 是实体名称, 不是 "Key"
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
    full_name VARCHAR(100), -- 员工真实姓名, 不是 "Key"
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name_key VARCHAR(100) NOT NULL, -- 【策略B】例如 "role.admin.global"
    description_key TEXT, -- 【策略B】例如 "role.admin.global.desc"
    UNIQUE(tenant_id, name_key)
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

INSERT INTO tenants (name) VALUES ('默认测试品牌');

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
    name_key VARCHAR(255) NOT NULL, -- 【策略B】例如 "asset.type.vr_goggle"
    description_key TEXT, -- 【策略B】
    UNIQUE(tenant_id, name_key)
);

CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    base_id UUID REFERENCES bases(id),
    asset_type_id UUID REFERENCES asset_types(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL, -- 资产实例名 (例如 "VR头盔-001号") 是唯一标识, 不是 "Key"
    model_number VARCHAR(100),
    status asset_status DEFAULT 'in_stock',
    purchase_date DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name_key VARCHAR(255) NOT NULL, -- 【策略B】例如 "material.rocket_kit"
    description_key TEXT, -- 【策略B】
    sku VARCHAR(100),
    unit_of_measure VARCHAR(50) DEFAULT '个', -- "个", "套" 等, 也可以改为 key
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE material_stock_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    base_id UUID NOT NULL REFERENCES bases(id),
    change_amount INT NOT NULL,
    reason_key VARCHAR(255) NOT NULL, -- 【策略B】例如 "stock.reason.course_consumption"
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

/* ... (索引省略, 但已包含在完整SQL中) ... */

/*
====================================================================
--- Phase 1: 会员 (Customer) 系统 (家长-学员 + 荣誉等级) ---
====================================================================
*/

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    base_id UUID REFERENCES bases(id),
    name VARCHAR(255), -- 家长真实姓名, 不是 "Key"
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
    name VARCHAR(255) NOT NULL, -- 学员真实姓名, 不是 "Key"
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
    name_key VARCHAR(255) NOT NULL, -- 【策略B】例如 "membership.tier.gold"
    description_key TEXT, -- 【策略B】
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
    name_key VARCHAR(100) NOT NULL, -- 【策略B】例如 "honor.rank.newbie"
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
    reason_key VARCHAR(255) NOT NULL, -- 【策略B】例如 "tx.reason.course_complete"
    -- 最好再加一个 context 字段来存储 "变量"
    -- context_json JSONB, -- 例如 {"course_name_key": "course.rocket.101"}
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
    bio TEXT, -- 教师简介 (自由文本), 不是 "Key"
    specialization TEXT, -- 擅长领域 (自由文本), 不是 "Key"
    qualifications TEXT, -- 资历 (自由文本), 不是 "Key"
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    base_id UUID NOT NULL REFERENCES bases(id),
    name VARCHAR(100) NOT NULL, -- 教室名 (例如 "化学实验室A"), 是实体名称, 不是 "Key"
    capacity INT DEFAULT 10,
    is_schedulable BOOLEAN DEFAULT true
);

CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name_key VARCHAR(255) NOT NULL, -- 【策略B】例如 "course.rocket.101"
    description_key TEXT, -- 【策略B】
    target_audience_key VARCHAR(100), -- 【策略B】例如 "age.range.8_10"
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
--- Phase 1: B端员工 登录日志 (新增) ---
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
    failure_reason_key VARCHAR(255) -- 【策略B】例如 "auth.error.wrong_password"
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

-- 登录日志索引
CREATE INDEX idx_user_login_history_user_id ON user_login_history (user_id);
CREATE INDEX idx_user_login_history_tenant_id ON user_login_history (tenant_id);
CREATE INDEX idx_user_login_history_email ON user_login_history (email_attempted);
CREATE INDEX idx_user_login_history_timestamp ON user_login_history (login_timestamp);

/*
====================================================================
--- 脚本结束 ---
====================================================================
*/