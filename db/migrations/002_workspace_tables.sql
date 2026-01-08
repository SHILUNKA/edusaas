-- 老板工作台所需的审批相关表和字段

-- 1. 支出/报销审批
ALTER TABLE expenses 
ADD COLUMN status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
ADD COLUMN approved_by UUID REFERENCES users(id),
ADD COLUMN approved_at TIMESTAMPTZ,
ADD COLUMN rejection_reason TEXT;

-- 2. 订单折扣审批
-- 如果订单包含折扣，前端应将其设为 pending
ALTER TABLE orders 
ADD COLUMN approval_status VARCHAR(20) DEFAULT 'approved', -- pending, approved, rejected (默认approved兼容旧数据)
ADD COLUMN approved_by UUID REFERENCES users(id),
ADD COLUMN approved_at TIMESTAMPTZ;

-- 3. 请假申请表
CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hq_id UUID NOT NULL REFERENCES hqs(id),
    base_id UUID NOT NULL REFERENCES bases(id),
    user_id UUID NOT NULL REFERENCES users(id), -- 申请人
    
    type VARCHAR(50) NOT NULL, -- sick, casual, annual, other
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    reason TEXT,
    
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 退费申请表
CREATE TABLE refund_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hq_id UUID NOT NULL REFERENCES hqs(id),
    base_id UUID NOT NULL REFERENCES bases(id),
    
    order_id UUID NOT NULL REFERENCES orders(id),
    participant_id UUID REFERENCES participants(id), -- 可选，针对个人的退费
    
    amount_cents INT NOT NULL,
    reason TEXT NOT NULL,
    
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, completed
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_expenses_status ON expenses(base_id, status);
CREATE INDEX idx_orders_approval_status ON orders(base_id, approval_status);
CREATE INDEX idx_leave_requests_status ON leave_requests(base_id, status);
CREATE INDEX idx_refund_requests_status ON refund_requests(base_id, status);
