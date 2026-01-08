/*
 * 决策看板所需的新增表
 * 创建时间: 2026-01-04
 */

-- 1. 基地配置表
CREATE TABLE IF NOT EXISTS base_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_id UUID NOT NULL UNIQUE REFERENCES bases(id) ON DELETE CASCADE,
    
    -- 营收目标
    monthly_revenue_target_cents INT DEFAULT 30000000, -- ¥300,000
    
    -- 审批门槛
    approval_threshold_cents INT DEFAULT 500000, -- ¥5,000
    
    -- 推送配置
    push_daily_summary BOOLEAN DEFAULT true,
    push_time TIME DEFAULT '10:00:00',
    dnd_start_time TIME DEFAULT '22:00:00',
    dnd_end_time TIME DEFAULT '08:00:00',
    
    -- 预警配置
    overdue_warning_days INT DEFAULT 7,
    tob_large_order_threshold_cents INT DEFAULT 1000000, -- ¥10,000
    
    -- ToB占比目标
    tob_ratio_target DECIMAL(3,2) DEFAULT 0.50, -- 50%
    
    -- 利润率警戒线
    profit_margin_warning DECIMAL(3,2) DEFAULT 0.30, -- 30%
    profit_margin_healthy DECIMAL(3,2) DEFAULT 0.50, -- 50%
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 触发器：自动更新 updated_at
CREATE TRIGGER set_timestamp_base_settings 
    BEFORE UPDATE ON base_settings 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_updated_at_column();

-- 2. 学员状态变更记录表（用于流失追踪）
CREATE TABLE IF NOT EXISTS participant_status_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    hq_id UUID NOT NULL REFERENCES hqs(id),
    base_id UUID REFERENCES bases(id),
    
    changed_from VARCHAR(20), -- active/inactive
    changed_to VARCHAR(20) NOT NULL,
    reason VARCHAR(255), -- 流失原因
    notes TEXT,
    
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_participant_status_changes_participant 
    ON participant_status_changes(participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_status_changes_date 
    ON participant_status_changes(changed_at);

-- 3. 现金账户表（用于现金流追踪）
CREATE TABLE IF NOT EXISTS finance_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hq_id UUID NOT NULL REFERENCES hqs(id),
    base_id UUID REFERENCES bases(id),
    
    account_type VARCHAR(20) NOT NULL, -- cash/bank/wechat/alipay
    account_name VARCHAR(100) NOT NULL,
    balance_cents INT NOT NULL DEFAULT 0,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 触发器
CREATE TRIGGER set_timestamp_finance_accounts 
    BEFORE UPDATE ON finance_accounts 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_updated_at_column();

-- 索引
CREATE INDEX IF NOT EXISTS idx_finance_accounts_base 
    ON finance_accounts(base_id) WHERE is_active = true;

-- 4. 为现有表添加缺失字段
-- customers 表已有的字段（之前已修改模型）: customer_type, lead_source, last_contact_at, notes, created_at

-- 检查 customers 表是否需要添加字段
DO $$ 
BEGIN
    -- 添加 customer_type
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customers' AND column_name = 'customer_type'
    ) THEN
        ALTER TABLE customers ADD COLUMN customer_type VARCHAR(20) DEFAULT 'prospect';
    END IF;
    
    -- 添加 lead_source  
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customers' AND column_name = 'lead_source'
    ) THEN
        ALTER TABLE customers ADD COLUMN lead_source VARCHAR(50);
    END IF;
    
    -- 添加 last_contact_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customers' AND column_name = 'last_contact_at'
    ) THEN
        ALTER TABLE customers ADD COLUMN last_contact_at TIMESTAMPTZ;
    END IF;
    
    -- 添加 notes
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customers' AND column_name = 'notes'
    ) THEN
        ALTER TABLE customers ADD COLUMN notes TEXT;
    END IF;
    
    -- 添加 assigned_sales
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customers' AND column_name = 'assigned_sales'
    ) THEN
        ALTER TABLE customers ADD COLUMN assigned_sales UUID REFERENCES users(id);
    END IF;
    
    -- 添加 tags (使用 TEXT[] 数组)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customers' AND column_name = 'tags'
    ) THEN
        ALTER TABLE customers ADD COLUMN tags TEXT[];
    END IF;
END $$;

-- 5. 为 participants 表添加 is_active 字段（如果没有）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'participants' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE participants ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- 6. 为 orders 表添加必要字段
DO $$ 
BEGIN
    -- 添加 due_date (应收款到期日期)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'due_date'
    ) THEN
        ALTER TABLE orders ADD COLUMN due_date DATE;
    END IF;
    
    -- 添加 paid_date (实际收款日期)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'paid_date'
    ) THEN
        ALTER TABLE orders ADD COLUMN paid_date DATE;
    END IF;
    
    -- 添加 progress_percentage (ToB订单执行进度)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'progress_percentage'
    ) THEN
        ALTER TABLE orders ADD COLUMN progress_percentage INT DEFAULT 0;
    END IF;
END $$;

-- 7. 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_orders_paid_date 
    ON orders(paid_date) WHERE status IN ('paid', 'partial_paid');

CREATE INDEX IF NOT EXISTS idx_orders_event_date 
    ON orders(event_date) WHERE type = 'b2b';

CREATE INDEX IF NOT EXISTS idx_orders_due_date 
    ON orders(due_date) WHERE status IN ('pending', 'partial_paid');

CREATE INDEX IF NOT EXISTS idx_expenses_date 
    ON expenses(expense_date);

CREATE INDEX IF NOT EXISTS idx_participants_active 
    ON participants(is_active, created_at);

-- COMMIT;
-- 注意：如果在事务中运行，最后需要 COMMIT;
