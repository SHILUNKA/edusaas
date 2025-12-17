// 对应后端 OrderDetail
export interface Order {
    id: string;
    order_no: string;
    type: 'b2b' | 'b2c' | 'b2g'; // 注意：后端返回 JSON 字段名为 "type" (因为 OrderDetail 加了 rename)
    status: string;
    customer_name: string;
    contact_name: string;
    
    // ★★★ 核心新增字段
    event_date: string | null;       
    expected_attendees: number;

    total_amount_cents: number;
    paid_amount_cents: number;
    created_at: string;
    payment_status: 'paid' | 'partial' | 'unpaid';
}

// 对应后端 CreateOrderPayload
export interface CreateOrderPayload {
    type_: string; // 注意：后端 CreateOrderPayload 里的字段名是 type_
    customer_id?: string;
    contact_name: string;
    total_amount: number;
    event_date: string; // YYYY-MM-DD
    expected_attendees: number;
}