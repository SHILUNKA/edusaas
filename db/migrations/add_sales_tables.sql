-- Migration: Add tables for sales and lead management
-- Created: 2025-12-31

-- 1. Create leads table (销售线索表)
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hq_id UUID NOT NULL REFERENCES hqs(id) ON DELETE CASCADE,
    base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
    
    -- 线索信息
    contact_name VARCHAR(255) NOT NULL,         -- 联系人姓名
    phone_number VARCHAR(50) NOT NULL,          -- 联系电话
    wechat_id VARCHAR(255),                      -- 微信号
    child_name VARCHAR(255),                     -- 孩子姓名
    child_age INTEGER,                           -- 孩子年龄
    child_grade VARCHAR(50),                     -- 孩子年级
    
    -- 来源与状态
    source VARCHAR(100),                         -- 线索来源 (online_ad/referral/walk_in/event/etc)
    status VARCHAR(50) DEFAULT 'new',           -- 状态 (new/contacted/qualified/trial_scheduled/converted/lost)
    quality_score INTEGER CHECK (quality_score BETWEEN 1 AND 5), -- 质量评分 1-5星
    
    -- 分配与跟进
    assigned_to UUID REFERENCES users(id),      -- 分配给销售顾问
    last_contact_at TIMESTAMP WITH TIME ZONE,   -- 最后联系时间
    next_follow_up_at TIMESTAMP WITH TIME ZONE, -- 下次跟进时间
    
    -- 转化信息
    converted_to_customer_id UUID REFERENCES customers(id), -- 转化为客户ID
    converted_at TIMESTAMP WITH TIME ZONE,      -- 转化时间
    lost_reason TEXT,                            -- 流失原因
    
    -- 备注
    notes TEXT,                                  -- 备注信息
    tags VARCHAR(255)[],                         -- 标签数组
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)        -- 创建人
);

-- 索引
CREATE INDEX idx_leads_base_id ON leads(base_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_phone ON leads(phone_number);
CREATE INDEX idx_leads_next_follow_up ON leads(next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;

-- 2. Create follow_up_records table (跟进记录表)
CREATE TABLE IF NOT EXISTS follow_up_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- 关联对象 (可以是线索或客户)
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    
    -- 跟进信息
    follow_up_type VARCHAR(50) NOT NULL,        -- 跟进方式 (call/wechat/visit/email/etc)
    content TEXT NOT NULL,                       -- 跟进内容
    outcome VARCHAR(100),                        -- 跟进结果 (positive/neutral/negative/no_answer/etc)
    
    -- 下次跟进
    next_follow_up_at TIMESTAMP WITH TIME ZONE, -- 下次跟进时间
    reminder_sent BOOLEAN DEFAULT FALSE,         -- 是否已发送提醒
    
    -- 记录人与时间
    created_by UUID NOT NULL REFERENCES users(id), -- 记录人
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT follow_up_target_check CHECK (
        (lead_id IS NOT NULL AND customer_id IS NULL) OR 
        (lead_id IS NULL AND customer_id IS NOT NULL)
    )
);

-- 索引
CREATE INDEX idx_follow_up_lead_id ON follow_up_records(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_follow_up_customer_id ON follow_up_records(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_follow_up_created_at ON follow_up_records(created_at DESC);

-- 3. Extend customers table with additional fields
ALTER TABLE customers 
    ADD COLUMN IF NOT EXISTS customer_type VARCHAR(50) DEFAULT 'prospect',  -- prospect/trial/active/inactive/churned
    ADD COLUMN IF NOT EXISTS lead_source VARCHAR(100),                      -- 来源渠道
    ADD COLUMN IF NOT EXISTS assigned_sales UUID REFERENCES users(id),     -- 负责销售
    ADD COLUMN IF NOT EXISTS tags VARCHAR(255)[],                           -- 客户标签
    ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMP WITH TIME ZONE,      -- 最后联系时间
    ADD COLUMN IF NOT EXISTS notes TEXT;                                    -- 备注

-- 索引
CREATE INDEX IF NOT EXISTS idx_customers_base_id ON customers(base_id) WHERE base_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(customer_type);
CREATE INDEX IF NOT EXISTS idx_customers_assigned_sales ON customers(assigned_sales) WHERE assigned_sales IS NOT NULL;

-- 4. Extend classes table to support trial classes
ALTER TABLE classes
    ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT FALSE,                -- 是否试听课
    ADD COLUMN IF NOT EXISTS trial_feedback TEXT,                           -- 试听反馈
    ADD COLUMN IF NOT EXISTS trial_result VARCHAR(50);                      -- 试听结果 (interested/not_interested/need_follow_up)

-- 索引
CREATE INDEX IF NOT EXISTS idx_classes_base_id ON classes(base_id);
CREATE INDEX IF NOT EXISTS idx_classes_is_trial ON classes(is_trial) WHERE is_trial = TRUE;
CREATE INDEX IF NOT EXISTS idx_classes_start_time ON classes(start_time);

-- 5. Create sales_performance table (销售业绩表)
CREATE TABLE IF NOT EXISTS sales_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hq_id UUID NOT NULL REFERENCES hqs(id) ON DELETE CASCADE,
    base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
    sales_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 月份
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    
    -- 绩效指标
    leads_count INTEGER DEFAULT 0,               -- 线索数
    trials_count INTEGER DEFAULT 0,              -- 试听数
    conversions_count INTEGER DEFAULT 0,         -- 转化数
    revenue_cents BIGINT DEFAULT 0,              -- 营收（分）
    commission_cents BIGINT DEFAULT 0,           -- 提成（分）
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(base_id, sales_user_id, year, month)
);

-- 索引
CREATE INDEX idx_sales_performance_base_id ON sales_performance(base_id);
CREATE INDEX idx_sales_performance_sales_user ON sales_performance(sales_user_id);
CREATE INDEX idx_sales_performance_period ON sales_performance(year DESC, month DESC);

-- 6. Create trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at_on_ext ON customers;
CREATE TRIGGER update_customers_updated_at_on_ext BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF NOT EXISTS update_sales_performance_updated_at ON sales_performance;
CREATE TRIGGER update_sales_performance_updated_at BEFORE UPDATE ON sales_performance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE leads IS '销售线索表';
COMMENT ON TABLE follow_up_records IS '跟进记录表';
COMMENT ON TABLE sales_performance IS '销售业绩表';
