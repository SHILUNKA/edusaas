/*
====================================================================
--- 数据库初始化脚本 (V25.1 - 增强版) ---
--- 更新内容: 
--- 1. 增加 auto_update_timestamp 触发器
--- 2. 补充高频查询索引
--- 3. 预设默认校区和管理员账号
====================================================================
*/

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 创建自动更新 updated_at 的函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

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
    code VARCHAR(20), 
    address TEXT,
    logo_url TEXT,
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
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
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- 微信字段
    wechat_openid VARCHAR(64) UNIQUE,
    wechat_unionid VARCHAR(64)
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
    
    -- ★★★ 修正：添加 UNIQUE 约束，防止重复绑定 ★★★
    wechat_openid VARCHAR(64) UNIQUE, 
    
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- 联合唯一索引：同一个总部下，手机号不能重复
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
--- Phase 4: 内部采购 & 智能排课 ---
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
    quantity INT NOT NULL CHECK (quantity > 0)
);

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
--- Phase 5: 财务与订单 ---
====================================================================
*/
CREATE TYPE order_type AS ENUM ('b2b', 'b2c', 'b2g');
CREATE TYPE order_status AS ENUM ('pending', 'partial_paid', 'paid', 'completed', 'refunded', 'cancelled');

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hq_id UUID NOT NULL REFERENCES hqs(id),
    base_id UUID NOT NULL REFERENCES bases(id),
    
    order_no VARCHAR(50) NOT NULL UNIQUE, 
    type order_type NOT NULL, 
    status order_status DEFAULT 'pending',
    
    customer_id UUID REFERENCES customers(id), 
    contact_name VARCHAR(100), 
    sales_id UUID REFERENCES users(id), 
    
    expected_attendees INT DEFAULT 0,
    actual_attendees INT DEFAULT 0,
    event_date DATE,
    
    total_amount_cents INT NOT NULL DEFAULT 0,
    paid_amount_cents INT NOT NULL DEFAULT 0,     
    discount_amount_cents INT NOT NULL DEFAULT 0, 
    
    invoice_status VARCHAR(20) DEFAULT 'unbilled', 
    contract_url TEXT,
    files TEXT[],

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE finance_payment_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hq_id UUID NOT NULL REFERENCES hqs(id),
    base_id UUID REFERENCES bases(id), 
    order_id UUID NOT NULL REFERENCES orders(id),
    
    transaction_type VARCHAR(20) NOT NULL DEFAULT 'INCOME', 
    channel VARCHAR(20) NOT NULL,          
    amount_cents INT NOT NULL,             
    
    payer_name VARCHAR(100),               
    proof_image_url TEXT,                  
    channel_transaction_id VARCHAR(100),   
    
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', 
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMPTZ,               
    verified_by UUID REFERENCES users(id)
);

CREATE TABLE hq_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hq_id UUID NOT NULL, 
    name VARCHAR(100) NOT NULL,
    sku VARCHAR(50), 
    type VARCHAR(20) NOT NULL, 
    price_cents INTEGER NOT NULL, 
    stock_quantity INTEGER DEFAULT 99999,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE supply_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hq_id UUID NOT NULL, 
    base_id UUID NOT NULL REFERENCES bases(id),
    order_no VARCHAR(50) NOT NULL, 
    total_amount_cents INTEGER NOT NULL, 
    status VARCHAR(20) DEFAULT 'pending_payment', 
    payment_proof_url TEXT, 
    logistics_info TEXT, 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE supply_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supply_order_id UUID NOT NULL REFERENCES supply_orders(id),
    product_id UUID NOT NULL REFERENCES hq_products(id),
    product_name VARCHAR(100) NOT NULL, 
    quantity INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL
);

CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hq_id UUID NOT NULL REFERENCES hqs(id),
    base_id UUID NOT NULL REFERENCES bases(id),
    category VARCHAR(50) NOT NULL, 
    amount_cents INTEGER NOT NULL, 
    description TEXT, 
    expense_date DATE DEFAULT CURRENT_DATE, 
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE base_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_id UUID NOT NULL REFERENCES bases(id),
    product_id UUID NOT NULL REFERENCES hq_products(id), 
    quantity INT NOT NULL DEFAULT 0, 
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(base_id, product_id) 
);

CREATE TABLE IF NOT EXISTS inventory_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_id UUID NOT NULL REFERENCES bases(id),
    product_id UUID NOT NULL REFERENCES hq_products(id),
    change_amount INT NOT NULL, 
    reason TEXT NOT NULL,       
    operator_name TEXT,         
    created_at TIMESTAMPTZ DEFAULT NOW()
);

/*
====================================================================
--- Phase 6: 日志与防伪 ---
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

CREATE TABLE qrcode_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_no VARCHAR(50) NOT NULL UNIQUE, 
    name VARCHAR(100),                    
    quantity INT NOT NULL,                
    created_by UUID,                      
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE qrcode_items (
    id BIGSERIAL PRIMARY KEY,
    batch_id UUID REFERENCES qrcode_batches(id),
    short_code VARCHAR(12) NOT NULL UNIQUE, 
    secret_salt VARCHAR(32) NOT NULL,       
    status VARCHAR(20) DEFAULT 'DORMANT',   
    scan_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_qrcode_short_code ON qrcode_items(short_code);

/*
====================================================================
--- Phase 7: 触发器与索引优化 ---
====================================================================
*/
-- 批量应用更新时间触发器
CREATE TRIGGER set_timestamp_hqs BEFORE UPDATE ON hqs FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER set_timestamp_bases BEFORE UPDATE ON bases FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER set_timestamp_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER set_timestamp_assets BEFORE UPDATE ON assets FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER set_timestamp_materials BEFORE UPDATE ON materials FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER set_timestamp_customers BEFORE UPDATE ON customers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER set_timestamp_participants BEFORE UPDATE ON participants FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER set_timestamp_courses BEFORE UPDATE ON courses FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER set_timestamp_orders BEFORE UPDATE ON orders FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER set_timestamp_supply_orders BEFORE UPDATE ON supply_orders FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 补充索引
CREATE INDEX IF NOT EXISTS idx_finance_order_base ON orders(hq_id, base_id);
CREATE INDEX IF NOT EXISTS idx_finance_order_date ON orders(event_date);
CREATE INDEX IF NOT EXISTS idx_finance_payment_status ON finance_payment_records (status);
CREATE INDEX IF NOT EXISTS idx_supply_orders_base ON supply_orders(base_id);
CREATE INDEX IF NOT EXISTS idx_expenses_base_date ON expenses(base_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_class_enroll_part ON class_enrollments(participant_id);
CREATE INDEX IF NOT EXISTS idx_class_enroll_class ON class_enrollments(class_id);

/*
====================================================================
--- Phase 8: Seed Data (初始数据预设) ---
====================================================================
*/

DO $$
DECLARE
    v_hq_id UUID;
    v_base_id UUID;
    v_role_hq_admin UUID;
    v_role_base_admin UUID;
    v_user_id UUID;
BEGIN
    -- 1. 创建 HQ
    INSERT INTO hqs (name) VALUES ('EduSaaS 示范集团') RETURNING id INTO v_hq_id;

    -- 2. 创建默认校区 (Base)
    INSERT INTO bases (hq_id, name, code, address, status, operation_mode) 
    VALUES (v_hq_id, '深圳湾示范校区', 'SZ1', '深圳市南山区科技园', 'active', 'direct') 
    RETURNING id INTO v_base_id;

    -- 3. 创建角色
    INSERT INTO roles (hq_id, name_key, description_key) VALUES (v_hq_id, 'role.hq.admin', '总部-总经理') RETURNING id INTO v_role_hq_admin;
    INSERT INTO roles (hq_id, name_key, description_key) VALUES (v_hq_id, 'role.hq.finance', '总部-财务');
    INSERT INTO roles (hq_id, name_key, description_key) VALUES (v_hq_id, 'role.base.admin', '校区-校长') RETURNING id INTO v_role_base_admin;
    INSERT INTO roles (hq_id, name_key, description_key) VALUES (v_hq_id, 'role.base.finance', '校区-财务');
    INSERT INTO roles (hq_id, name_key, description_key) VALUES (v_hq_id, 'role.teacher', '校区-教师');

    -- 4. 创建超级管理员 (HQ Admin)
    -- ⚠️ 注意: 这里的 password_hash 是 bcrypt('password123') 的结果
    -- 如果你后端用的是其他加密方式，请更新这里的 hash
    INSERT INTO users (hq_id, base_id, email, password_hash, full_name, is_active, staff_status)
    VALUES (
        v_hq_id, 
        NULL, 
        'admin@edusaas.com', 
        '$2a$12$MQ.d/i.2.1/i.2.1/i.2.1/i.2.1/i.2.1/i.2.1/i.2.1/i.2.1', -- 示例Hash (实际上你需要用真实后端的Hash逻辑替换)
        'Super Admin', 
        true, 
        'active'
    ) RETURNING id INTO v_user_id;

    -- 赋予 HQ Admin 角色
    INSERT INTO user_roles (user_id, role_id) VALUES (v_user_id, v_role_hq_admin);

    -- 5. 创建默认体验课
    INSERT INTO courses (hq_id, name_key, description_key, type, points_awarded)
    VALUES (v_hq_id, '航天科学-0元体验课', '引流公开课', 'trial', 0);

    -- 6. 创建军衔体系
    INSERT INTO honor_ranks (hq_id, name_key, rank_level, points_required)
    VALUES 
    (v_hq_id, '列兵', 1, 0),
    (v_hq_id, '上等兵', 2, 100),
    (v_hq_id, '少尉', 10, 15000);

END $$;