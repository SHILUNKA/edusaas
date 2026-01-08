-- 插入测试数据用于老板工作台

-- 1. 获取一个 Base ID (使用 sz_principal 的 Base)
DO $$
DECLARE
    v_base_id UUID;
    v_hq_id UUID;
    v_user_id UUID;
    v_customer_id UUID;
    v_order_id UUID;
BEGIN
    SELECT base_id, id INTO v_base_id, v_user_id FROM users WHERE email = 'sz_principal@edusaas.com';
    SELECT hq_id INTO v_hq_id FROM bases WHERE id = v_base_id;
    
    -- 创建一个客户
    INSERT INTO customers (hq_id, base_id, name, phone_number, customer_type) 
    VALUES (v_hq_id, v_base_id, '待审批客户', '13800138000', 'lead')
    RETURNING id INTO v_customer_id;

    -- 1. 待审批折扣订单 (3个)
    FOR i IN 1..3 LOOP
        INSERT INTO orders (hq_id, base_id, order_no, type, status, customer_id, total_amount_cents, discount_amount_cents, approval_status, created_at)
        VALUES (v_hq_id, v_base_id, 'ORD-TEST-' || i, 'b2c', 'pending', v_customer_id, 100000, 20000, 'pending', NOW());
    END LOOP;
    
    -- 获取一个订单ID用于退费
    SELECT id INTO v_order_id FROM orders WHERE base_id = v_base_id LIMIT 1;

    -- 2. 待审批退费 (1个)
    INSERT INTO refund_requests (hq_id, base_id, order_id, amount_cents, reason, status, created_by)
    VALUES (v_hq_id, v_base_id, v_order_id, 50000, '家长不满意教学质量', 'pending', v_user_id);

    -- 3. 待审批报销 (5个)
    FOR i IN 1..5 LOOP
        INSERT INTO expenses (hq_id, base_id, category, amount_cents, description, status, created_by, expense_date)
        VALUES (v_hq_id, v_base_id, 'supplies', 10000 + i*100, '购买教具耗材-' || i, 'pending', v_user_id, CURRENT_DATE);
    END LOOP;

    -- 4. 待审批请假 (2个) - 一个病假，一个事假
    INSERT INTO leave_requests (hq_id, base_id, user_id, type, start_time, end_time, reason, status)
    VALUES 
    (v_hq_id, v_base_id, v_user_id, 'sick', NOW(), NOW() + INTERVAL '1 day', '感冒发烧', 'pending'),
    (v_hq_id, v_base_id, v_user_id, 'casual', NOW() + INTERVAL '3 days', NOW() + INTERVAL '5 days', '家里有事', 'pending');

END $$;
