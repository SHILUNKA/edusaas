/*
====================================================================
--- 数据库初始化脚本 (V25.0 - 最终精简优化版) ---
--- 核心设计:
--- 1. 收入中心: orders (B2C/B2B/B2G)
--- 2. 成本中心: supply_orders (采购) + expenses (运营支出)
--- 3. 资金中心: finance_payment_records (实际流水)
--- 4. 彻底移除旧版总账表，实现轻量化 SaaS 架构
====================================================================
*/

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

/*
====================================================================
--- Phase 0: 基础架构 (租户, 基地, 员工, 角色) ---
====================================================================
*/
CREATE TYPE staff_status AS ENUM ('active', 'pending', 'resigned');

CREATE TABLE hqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL, 
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hq_id UUID NOT NULL REFERENCES hqs(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, 
    code VARCHAR(20), -- 订单前缀 (如 SZ1)
    address TEXT,
    logo_url TEXT,
    
    -- 运营状态: active(运营), preparing(筹备), suspended(停业), closed(关闭)
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    -- 经营模式: direct(直营), franchise(加盟), partner(合作)
    operation_mode VARCHAR(20) DEFAULT 'direct' NOT NULL,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hq_id UUID NOT NULL REFERENCES hqs(id) ON DELETE CASCADE,
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
    hq_id UUID NOT NULL REFERENCES hqs(id) ON DELETE CASCADE,
    name_key VARCHAR(100) NOT NULL, 
    description_key TEXT, 
    UNIQUE(hq_id, name_key)
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
    hq_id UUID NOT NULL REFERENCES hqs(id) ON DELETE CASCADE,
    name_key VARCHAR(255) NOT NULL, 
    description_key TEXT,
    UNIQUE(hq_id, name_key)
);

CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hq_id UUID NOT NULL REFERENCES hqs(id) ON DELETE CASCADE,
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
    hq_id UUID NOT NULL REFERENCES hqs(id) ON DELETE CASCADE,
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
    hq_id UUID NOT NULL REFERENCES hqs(id) ON DELETE CASCADE,
    base_id UUID REFERENCES bases(id),
    name VARCHAR(255), 
    phone_number VARCHAR(50) NOT NULL,
    wechat_openid VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hq_id, phone_number)
);

CREATE TABLE participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hq_id UUID NOT NULL REFERENCES hqs(id) ON DELETE CASCADE,
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
    hq_id UUID NOT NULL REFERENCES hqs(id) ON DELETE CASCADE,
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
    hq_id UUID NOT NULL REFERENCES hqs(id),
    start_date TIMESTAMPTZ NOT NULL,
    expiry_date TIMESTAMPTZ,
    remaining_uses INT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE honor_ranks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hq_id UUID NOT NULL REFERENCES hqs(id) ON DELETE CASCADE,
    name_key VARCHAR(100) NOT NULL, 
    rank_level INT NOT NULL,
    points_required INT NOT NULL DEFAULT 0,
    badge_icon_url TEXT,
    UNIQUE(hq_id, rank_level),
    UNIQUE(hq_id, name_key)
);

CREATE TABLE participant_profiles (
    participant_id UUID PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
    hq_id UUID NOT NULL REFERENCES hqs(id) ON DELETE CASCADE,
    current_total_points INT NOT NULL DEFAULT 0,
    current_honor_rank_id UUID REFERENCES honor_ranks(id),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE point_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    hq_id UUID NOT NULL REFERENCES hqs(id) ON DELETE CASCADE,
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
    hq_id UUID NOT NULL REFERENCES hqs(id) ON DELETE CASCADE,
    base_id UUID REFERENCES bases(id),
    bio TEXT, 
    specialization TEXT, 
    qualifications TEXT, 
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hq_id UUID NOT NULL REFERENCES hqs(id) ON DELETE CASCADE,
    base_id UUID NOT NULL REFERENCES bases(id),
    name VARCHAR(100) NOT NULL, 
    capacity INT DEFAULT 10,
    is_schedulable BOOLEAN DEFAULT true,
    layout_rows INT DEFAULT 5,
    layout_columns INT DEFAULT 6
);

CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hq_id UUID NOT NULL REFERENCES hqs(id) ON DELETE CASCADE,
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
    hq_id UUID NOT NULL REFERENCES hqs(id) ON DELETE CASCADE,
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
    hq_id UUID NOT NULL REFERENCES hqs(id) ON DELETE CASCADE,
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
--- Phase 4: 内部采购 (Internal Procurement) ---
--- 场景: 基地内部老师向库管申请领用物资，不是向总部买 ---
====================================================================
*/
CREATE TYPE procurement_status AS ENUM ('pending', 'approved', 'rejected', 'shipped', 'received');

CREATE TABLE procurement_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hq_id UUID NOT NULL REFERENCES hqs(id) ON DELETE CASCADE,
    base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
    applicant_id UUID REFERENCES users(id),
    status procurement_status DEFAULT 'pending',
    submit_note TEXT, 
    reject_reason TEXT, 
    logistics_company TEXT,
    tracking_number TEXT,
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
    hq_id UUID REFERENCES hqs(id) ON DELETE SET NULL,
    login_timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(100),
    user_agent TEXT,
    status login_status NOT NULL,
    failure_reason_key VARCHAR(255) 
);

/*
====================================================================
--- Phase 7: 财务与收入中心 (Finance & Revenue) ---
--- 场景: 学员交学费 (B2C) / 企业政府打款 (B2B/B2G) ---
====================================================================
*/

CREATE TYPE order_type AS ENUM ('b2b', 'b2c', 'b2g');
CREATE TYPE order_status AS ENUM ('pending', 'partial_paid', 'paid', 'completed', 'refunded', 'cancelled');

-- 1. 收入订单表 (Orders)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hq_id UUID NOT NULL REFERENCES hqs(id),
    base_id UUID NOT NULL REFERENCES bases(id),
    
    order_no VARCHAR(50) NOT NULL UNIQUE, 
    type order_type NOT NULL, -- b2c(散客), b2b(校企), b2g(政府)
    status order_status DEFAULT 'pending',
    
    customer_id UUID REFERENCES customers(id), -- 关联散客/联系人
    contact_name VARCHAR(100), 
    
    -- 业务数据
    expected_attendees INT DEFAULT 0,
    actual_attendees INT DEFAULT 0,
    event_date DATE,
    
    -- 财务数据 (单位: 分)
    total_amount_cents INT NOT NULL DEFAULT 0,    -- 应收总额
    paid_amount_cents INT NOT NULL DEFAULT 0,     -- 实收总额
    discount_amount_cents INT NOT NULL DEFAULT 0, 
    
    -- ★ 核心修正：保留这个带外键约束的，删除后面重复的
    sales_id UUID REFERENCES users(id), 
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- 新增字段
    invoice_status VARCHAR(20) DEFAULT 'unbilled', -- unbilled, billing, billed
    contract_url TEXT,
    files TEXT[] -- 建议加上这个，用来存其他附件数组
);

-- 2. 资金流水/支付凭证表 (唯一的资金流向表)
CREATE TABLE finance_payment_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    hq_id UUID NOT NULL REFERENCES hqs(id),
    base_id UUID REFERENCES bases(id), 
    
    order_id UUID NOT NULL REFERENCES orders(id),
    
    transaction_type VARCHAR(20) NOT NULL DEFAULT 'INCOME', -- INCOME(收款), REFUND(退款)
    channel VARCHAR(20) NOT NULL,          -- BANK_TRANSFER, WECHAT, ALIPAY
    amount_cents INT NOT NULL,             -- 金额（分）
    
    -- 线下转账字段
    payer_name VARCHAR(100),               -- 对方户名
    proof_image_url TEXT,                  -- 凭证截图
    
    -- 线上支付字段
    channel_transaction_id VARCHAR(100),   
    
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, VERIFIED, FAILED
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMPTZ,               
    verified_by UUID REFERENCES users(id)
);

/*
====================================================================
--- Phase 8: 供应链与成本中心 (Supply Chain & Expenses) ---
--- 场景: 基地向总部进货 (Supply) / 基地付房租工资 (Expenses) ---
====================================================================
*/

-- 1. 总部商品/服务表
CREATE TABLE hq_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hq_id UUID NOT NULL, -- 归属总部
    name VARCHAR(100) NOT NULL,
    sku VARCHAR(50), 
    type VARCHAR(20) NOT NULL, -- 'material', 'service'
    price_cents INTEGER NOT NULL, -- 批发单价
    stock_quantity INTEGER DEFAULT 99999,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 基地采购订单表 (B2B 商城订单)
CREATE TABLE supply_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hq_id UUID NOT NULL, 
    base_id UUID NOT NULL REFERENCES bases(id),
    order_no VARCHAR(50) NOT NULL, -- PUR-SZ1-251212-001
    
    total_amount_cents INTEGER NOT NULL, 
    status VARCHAR(20) DEFAULT 'pending_payment', -- pending_payment, paid, shipped, completed
    
    payment_proof_url TEXT, 
    logistics_info TEXT, 
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 采购订单明细
CREATE TABLE supply_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supply_order_id UUID NOT NULL REFERENCES supply_orders(id),
    product_id UUID NOT NULL REFERENCES hq_products(id),
    product_name VARCHAR(100) NOT NULL, 
    quantity INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL
);

-- 4. 基地运营支出表 (房租、工资、水电等)
-- ★ 替代了旧版的 cost_records
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hq_id UUID NOT NULL REFERENCES hqs(id),
    base_id UUID NOT NULL REFERENCES bases(id),
    
    category VARCHAR(50) NOT NULL, -- 'rent', 'salary', 'utility', 'marketing', 'other'
    amount_cents INTEGER NOT NULL, -- 支出金额
    description TEXT, -- 备注
    expense_date DATE DEFAULT CURRENT_DATE, 
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE base_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_id UUID NOT NULL REFERENCES bases(id),
    product_id UUID NOT NULL REFERENCES hq_products(id), -- 关联回总部的商品ID
    quantity INT NOT NULL DEFAULT 0, -- 当前持有的数量
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 联合唯一索引：一个基地对同一个商品只有一条记录
    UNIQUE(base_id, product_id) 
);
CREATE TABLE IF NOT EXISTS inventory_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_id UUID NOT NULL REFERENCES bases(id),
    product_id UUID NOT NULL REFERENCES hq_products(id),
    change_amount INT NOT NULL, -- 负数表示消耗(领用)，正数表示增加(入库)
    reason TEXT NOT NULL,       -- 例如：教学使用、损坏、采购入库
    operator_name TEXT,         -- 操作人名字 (暂时可选)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

/*
====================================================================
--- 防伪码区 ---
====================================================================
*/
-- 1. 批次表：记录每一次“印刷任务”
CREATE TABLE qrcode_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_no VARCHAR(50) NOT NULL UNIQUE, -- 批次号，如 P20251218-01
    name VARCHAR(100),                    -- 备注，如 "第一批盲盒印刷"
    quantity INT NOT NULL,                -- 数量
    created_by UUID,                      -- 操作人
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 二维码明细表：核心资产
CREATE TABLE qrcode_items (
    id BIGSERIAL PRIMARY KEY,
    batch_id UUID REFERENCES qrcode_batches(id),
    
    short_code VARCHAR(12) NOT NULL UNIQUE, -- 明码 (印在二维码图里的)
    secret_salt VARCHAR(32) NOT NULL,       -- 暗码 (用于后端验签，不公开)
    
    status VARCHAR(20) DEFAULT 'DORMANT',   -- 状态: DORMANT(休眠), ACTIVE(已激活), SCANNED(已扫)
    scan_count INT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引以加速查询
CREATE INDEX idx_qrcode_short_code ON qrcode_items(short_code);
/*
====================================================================
--- 索引优化区 ---
====================================================================
*/
CREATE INDEX IF NOT EXISTS idx_finance_order_base ON orders(hq_id, base_id);
CREATE INDEX IF NOT EXISTS idx_finance_order_date ON orders(event_date);
CREATE INDEX IF NOT EXISTS idx_finance_payment_status ON finance_payment_records (status);
CREATE INDEX IF NOT EXISTS idx_supply_orders_base ON supply_orders(base_id);
CREATE INDEX IF NOT EXISTS idx_expenses_base_date ON expenses(base_id, expense_date);

/*
====================================================================
--- Seed Data: 初始数据预设 ---
====================================================================
*/

-- 1. 租户与角色
INSERT INTO hqs (name) VALUES ('EduSaaS 示范集团') ON CONFLICT DO NOTHING;

-- HQ Roles
INSERT INTO roles (hq_id, name_key, description_key)
SELECT id, 'role.hq.admin', '总部-总经理' FROM hqs LIMIT 1 ON CONFLICT (hq_id, name_key) DO UPDATE SET description_key = EXCLUDED.description_key;
INSERT INTO roles (hq_id, name_key, description_key)
SELECT id, 'role.hq.finance', '总部-财务' FROM hqs LIMIT 1 ON CONFLICT (hq_id, name_key) DO UPDATE SET description_key = EXCLUDED.description_key;
-- Campus Roles
INSERT INTO roles (hq_id, name_key, description_key)
SELECT id, 'role.base.admin', '校区-校长' FROM hqs LIMIT 1 ON CONFLICT (hq_id, name_key) DO UPDATE SET description_key = EXCLUDED.description_key;
INSERT INTO roles (hq_id, name_key, description_key)
SELECT id, 'role.base.finance', '校区-财务' FROM hqs LIMIT 1 ON CONFLICT (hq_id, name_key) DO UPDATE SET description_key = EXCLUDED.description_key;
INSERT INTO roles (hq_id, name_key, description_key)
SELECT id, 'role.teacher', '校区-教师' FROM hqs LIMIT 1 ON CONFLICT (hq_id, name_key) DO UPDATE SET description_key = EXCLUDED.description_key;

-- 预设体验课
INSERT INTO courses (hq_id, name_key, description_key, type, points_awarded)
SELECT id, '航天科学-0元体验课', '引流公开课', 'trial', 0 FROM hqs LIMIT 1;

-- 预设军衔
INSERT INTO honor_ranks (hq_id, name_key, rank_level, points_required)
VALUES 
((SELECT id FROM hqs LIMIT 1), '列兵', 1, 0),
((SELECT id FROM hqs LIMIT 1), '上等兵', 2, 100),
((SELECT id FROM hqs LIMIT 1), '少尉', 10, 15000)
ON CONFLICT DO NOTHING;

ALTER TABLE orders 
ADD CONSTRAINT fk_orders_sales FOREIGN KEY (sales_id) REFERENCES users(id);
/*
====================================================================
--- 脚本结束 ---
====================================================================
*/