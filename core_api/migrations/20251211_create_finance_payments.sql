-- 1. 创建支付流水表 (核心资金表)
CREATE TABLE IF NOT EXISTS finance_payment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 多租户与基地隔离 (必须强制校验)
    tenant_id UUID NOT NULL,
    base_id UUID, 
    
    -- 业务关联
    order_id UUID NOT NULL REFERENCES orders(id),
    
    -- 交易详情
    transaction_type VARCHAR(20) NOT NULL DEFAULT 'INCOME', -- INCOME(收款), REFUND(退款)
    channel VARCHAR(20) NOT NULL,          -- BANK_TRANSFER(线下对公), WECHAT, ALIPAY
    amount_cents INT NOT NULL,             -- 金额（分）
    
    -- 线下转账特有字段
    payer_name VARCHAR(100),               -- 对方户名 (方便财务核对网银流水)
    proof_image_url TEXT,                  -- 转账凭证/回单截图
    
    -- 线上支付特有字段
    channel_transaction_id VARCHAR(100),   -- 微信/支付宝流水号
    
    -- 状态机
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING(待确认), VERIFIED(财务已核实), FAILED
    
    -- 审计字段
    created_at TIMESTAMPTZ DEFAULT NOW(),
    verified_at TIMESTAMPTZ,               -- 财务确认时间
    verified_by UUID                       -- 操作的财务人员ID
);

-- 2. 创建索引 (优化财务报表查询速度)
CREATE INDEX IF NOT EXISTS idx_finance_payment_tenant_date ON finance_payment_records (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_finance_payment_order ON finance_payment_records (order_id);
CREATE INDEX IF NOT EXISTS idx_finance_payment_status ON finance_payment_records (status);