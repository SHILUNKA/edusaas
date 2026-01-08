-- 试听课管理表
CREATE TABLE IF NOT EXISTS trial_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_id UUID NOT NULL REFERENCES bases(id),
    lead_id UUID REFERENCES leads(id), -- 可选，可能从客户转化而来
    
    -- 学员信息
    student_name VARCHAR(100) NOT NULL,
    student_age INTEGER,
    student_grade VARCHAR(50),
    
    -- 家长信息
    parent_name VARCHAR(100) NOT NULL,
    parent_phone VARCHAR(20) NOT NULL,
    parent_wechat VARCHAR(100),
    
    -- 预约信息
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration INTEGER DEFAULT 60, -- 时长（分钟）
    teacher_id UUID REFERENCES users(id),
    classroom VARCHAR(100),
    course_type VARCHAR(100), -- 课程类型：英语/数学/艺术等
    
    -- 状态管理
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending/confirmed/completed/cancelled
    
    -- 反馈信息（课后填写）
    feedback TEXT,
    student_performance INTEGER CHECK (student_performance >= 1 AND student_performance <= 5), -- 1-5分
    parent_satisfaction INTEGER CHECK (parent_satisfaction >= 1 AND student_performance <= 5), -- 1-5分
    conversion_intent VARCHAR(50), -- high/medium/low/none
    
    -- 其他
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_trial_classes_base ON trial_classes(base_id);
CREATE INDEX IF NOT EXISTS idx_trial_classes_lead ON trial_classes(lead_id);
CREATE INDEX IF NOT EXISTS idx_trial_classes_status ON trial_classes(status);
CREATE INDEX IF NOT EXISTS idx_trial_classes_scheduled ON trial_classes(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_trial_classes_teacher ON trial_classes(teacher_id);

-- 更新时间触发器
CREATE TRIGGER update_trial_classes_updated_at
    BEFORE UPDATE ON trial_classes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
