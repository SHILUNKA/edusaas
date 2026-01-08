-- 添加总部缺失的角色
-- 2025-12-31: 补充完整的角色体系

DO $$
DECLARE
    v_hq_id UUID;
BEGIN
    -- 获取第一个HQ的ID（示例环境通常只有一个）
    SELECT id INTO v_hq_id FROM hqs LIMIT 1;
    
    -- 总部角色
    INSERT INTO roles (hq_id, name_key, description_key)
    VALUES (v_hq_id, 'role.hq.hr', '总部-人力资源')
    ON CONFLICT DO NOTHING;
    
    INSERT INTO roles (hq_id, name_key, description_key)
    VALUES (v_hq_id, 'role.hq.marketing', '总部-市场营销')
    ON CONFLICT DO NOTHING;
    
    -- 基地角色
    INSERT INTO roles (hq_id, name_key, description_key)
    VALUES (v_hq_id, 'role.base.marketing', '基地-市场营销')
    ON CONFLICT DO NOTHING;
    
    -- 用户角色（家长/学员）
    INSERT INTO roles (hq_id, name_key, description_key)
    VALUES (v_hq_id, 'role.consumer', '用户-家长学员')
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE '✅ 角色体系补充完成';
END $$;

-- 查看当前所有角色
SELECT name_key, description_key FROM roles ORDER BY name_key;
