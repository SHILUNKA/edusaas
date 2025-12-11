/*
====================================================================
--- 数据库初始化脚本 (V23.0 - 业财一体化完整版) ---
--- 包含: 
--- 1. 基础: 租户, 基地, 员工, 角色
--- 2. 教务: 课程, 班级, 排课
--- 3. 业务: CRM, 会员, 积分
--- 4. 运营: 物资, 采购
--- 5. 财务: 订单(B2B/C), 成本, 资金流水 (★ 重点升级)
====================================================================
*/

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

/*
====================================================================
--- Phase 0: SaaS 基础 (租户, 员工, 角色) ---
====================================================================
*/
CREATE TYPE staff_status AS ENUM ('active', 'pending', 'resigned');

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
    logo_url TEXT,
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
    staff_status staff_status DEFAULT 'active',
    
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
CREATE TYPE asset_status AS ENUM ('in_stock', 'in_use', 'in_class', 'in_maintenance', 'retired');

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
    serial_number VARCHAR(100),  
    price_in_cents INT DEFAULT 0, 
    warranty_until DATE,          
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
--- Phase 2: CRM 与 会员系统 ---
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
    avatar_url TEXT, 
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE membership_tier_type AS ENUM ('time_based', 'usage_based');

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
--- Phase 3: 教务 (教师, 课程, 排课) ---
====================================================================
*/
CREATE TYPE course_type AS ENUM ('regular', 'trial');

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
    is_schedulable BOOLEAN DEFAULT true,
    layout_rows INT DEFAULT 5,
    layout_columns INT DEFAULT 6
);

CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name_key VARCHAR(255) NOT NULL, 
    description_key TEXT,
    type course_type DEFAULT 'regular',
    target_audience_key VARCHAR(100), 
    default_duration_minutes INT NOT NULL DEFAULT 60,
    points_awarded INT NOT NULL DEFAULT 0,
    prerequisite_course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    cover_url TEXT,       
    introduction TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
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
    room_id UUID NOT NULL REFERENCES rooms(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    max_capacity INT NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled'
);

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
    customer_membership_id UUID REFERENCES customer_memberships(id),
    status VARCHAR(50) DEFAULT 'enrolled',
    teacher_feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(class_id, participant_id)
);

/*
====================================================================
--- Phase 4: 采购与供应链 ---
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
--- Phase 5: 智能排课基础 ---
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
--- Phase 6: 日志与历史 ---
====================================================================
*/
CREATE TYPE login_status AS ENUM ('success', 'failed');

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
--- Phase 7: 财务中心 (Financial Center) - (★ V23.0 业财一体化) ---
====================================================================
*/

-- 1. 核心枚举
CREATE TYPE order_type AS ENUM ('b2b', 'b2c', 'b2g');
CREATE TYPE order_status AS ENUM ('pending', 'partial_paid', 'paid', 'completed', 'refunded', 'cancelled');
CREATE TYPE cost_category AS ENUM ('transport', 'catering', 'accommodation', 'labor', 'material', 'insurance', 'other');

CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'refund', 'usage', 'adjustment');
CREATE TYPE transaction_category AS ENUM ('membership_sale', 'procurement_cost', 'course_revenue', 'salary', 'utility', 'rent', 'other');
CREATE TYPE account_subject AS ENUM ('cash', 'contract_liability', 'revenue', 'cost', 'expense', 'refund_payable');

-- 2. 订单主表 (收入中心)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    base_id UUID NOT NULL REFERENCES bases(id),
    
    order_no VARCHAR(50) NOT NULL UNIQUE, 
    type order_type NOT NULL,
    status order_status DEFAULT 'pending',
    
    customer_id UUID REFERENCES customers(id), 
    contact_name VARCHAR(100), 
    
    -- 业务数据
    expected_attendees INT DEFAULT 0, -- 预计人数
    actual_attendees INT DEFAULT 0,   -- 实到人数
    event_date DATE,                  -- 活动日期
    
    -- 财务数据 (单位: 分)
    total_amount_cents INT NOT NULL DEFAULT 0,    -- 合同总金额
    paid_amount_cents INT NOT NULL DEFAULT 0,     -- 已收金额
    discount_amount_cents INT NOT NULL DEFAULT 0, 
    
    sales_id UUID REFERENCES users(id), 
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. 成本记录表 (成本中心)
CREATE TABLE cost_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    base_id UUID NOT NULL REFERENCES bases(id),
    
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL, -- 关联收入订单
    
    category cost_category NOT NULL, 
    amount_cents INT NOT NULL DEFAULT 0, 
    
    supplier_name VARCHAR(100), 
    description TEXT,
    
    is_paid BOOLEAN DEFAULT false, 
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. 资金流水表 (资金中心)
CREATE TABLE financial_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    base_id UUID REFERENCES bases(id) ON DELETE SET NULL,
    
    amount_in_cents INT NOT NULL, 
    transaction_type transaction_type NOT NULL,
    category transaction_category NOT NULL,
    debit_subject account_subject,  
    credit_subject account_subject, 

    related_entity_id UUID, 
    
    -- ★ V23.0 新增关联
    order_id UUID REFERENCES orders(id),
    cost_record_id UUID REFERENCES cost_records(id),
    
    description TEXT,       
    created_by UUID REFERENCES users(id) ON DELETE SET NULL, 
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

/*
====================================================================
--- 索引区 ---
====================================================================
*/
-- (保留之前的索引，这里省略部分重复代码，核心索引如下)
CREATE INDEX idx_finance_order_tenant ON orders(tenant_id, base_id);
CREATE INDEX idx_finance_order_date ON orders(event_date);
CREATE INDEX idx_finance_cost_order ON cost_records(order_id);
CREATE INDEX idx_finance_trans_time ON financial_transactions(created_at);

/*
====================================================================
--- Seed Data: 初始数据预设 ---
====================================================================
*/

-- 1. 租户与角色
INSERT INTO tenants (name) VALUES ('EduSaaS 示范集团') ON CONFLICT DO NOTHING;

-- HQ Roles
INSERT INTO roles (tenant_id, name_key, description_key)
SELECT id, 'role.tenant.admin', '总部-总经理 (全权)' FROM tenants LIMIT 1 ON CONFLICT (tenant_id, name_key) DO UPDATE SET description_key = EXCLUDED.description_key;
INSERT INTO roles (tenant_id, name_key, description_key)
SELECT id, 'role.tenant.finance', '总部-财务总监 (资金/审批)' FROM tenants LIMIT 1 ON CONFLICT (tenant_id, name_key) DO UPDATE SET description_key = EXCLUDED.description_key;
INSERT INTO roles (tenant_id, name_key, description_key)
SELECT id, 'role.tenant.operation', '总部-运营/教研 (课程/资产)' FROM tenants LIMIT 1 ON CONFLICT (tenant_id, name_key) DO UPDATE SET description_key = EXCLUDED.description_key;
INSERT INTO roles (tenant_id, name_key, description_key)
SELECT id, 'role.tenant.hr', '总部-人事 (员工管理)' FROM tenants LIMIT 1 ON CONFLICT (tenant_id, name_key) DO UPDATE SET description_key = EXCLUDED.description_key;

-- Campus Roles
INSERT INTO roles (tenant_id, name_key, description_key)
SELECT id, 'role.base.admin', '校区-校长 (校区全权)' FROM tenants LIMIT 1 ON CONFLICT (tenant_id, name_key) DO UPDATE SET description_key = EXCLUDED.description_key;
INSERT INTO roles (tenant_id, name_key, description_key)
SELECT id, 'role.base.academic', '校区-教务主管 (排课/学员)' FROM tenants LIMIT 1 ON CONFLICT (tenant_id, name_key) DO UPDATE SET description_key = EXCLUDED.description_key;
INSERT INTO roles (tenant_id, name_key, description_key)
SELECT id, 'role.base.finance', '校区-财务/前台 (收费/采购)' FROM tenants LIMIT 1 ON CONFLICT (tenant_id, name_key) DO UPDATE SET description_key = EXCLUDED.description_key;
INSERT INTO roles (tenant_id, name_key, description_key)
SELECT id, 'role.teacher', '校区-普通教师 (上课/查看课表)' FROM tenants LIMIT 1 ON CONFLICT (tenant_id, name_key) DO UPDATE SET description_key = EXCLUDED.description_key;

-- 预设体验课
INSERT INTO courses (tenant_id, name_key, description_key, type, points_awarded)
SELECT id, '航天科学-0元体验课', '用于引流的公开课', 'trial', 0
FROM tenants LIMIT 1;

-- 预设待入职员工
INSERT INTO users (tenant_id, email, password_hash, full_name, staff_status, role_key)
SELECT id, 'pending_hr@hq.com', 'hashed_pw', '王后备', 'pending', 'role.teacher'
FROM tenants LIMIT 1;

-- 预设军衔 (省略部分，保持原样)
INSERT INTO honor_ranks (tenant_id, name_key, rank_level, points_required)
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