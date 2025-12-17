'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { Loader2, CheckCircle, Truck, Package, FileText } from 'lucide-react';

interface SupplyOrder {
    id: string;
    order_no: string;
    base_name: string;
    total_amount_cents: number;
    status: 'pending_payment' | 'paid' | 'shipped' | 'completed';
    items_summary: string;
    payment_proof_url: string | null;
    created_at: string;
}

export default function HQSupplyOrdersPage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const [orders, setOrders] = useState<SupplyOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        if (token) fetchOrders();
    }, [token]);

    const fetchOrders = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/hq/supply/orders`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setOrders(await res.json());
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    // 动作：确认收款
    const handleConfirmPayment = async (id: string) => {
        if (!confirm("确认已收到该基地的转账款项吗？")) return;
        setProcessingId(id);
        try {
            const res = await fetch(`${API_BASE_URL}/hq/supply/orders/${id}/confirm`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                alert("收款确认成功！");
                fetchOrders();
            }
        } catch (e) { alert("操作失败"); }
        setProcessingId(null);
    };

    // 动作：发货
    const handleShip = async (id: string) => {
        const logisticsInfo = prompt("请输入物流单号 (如: 顺丰 SF123456)");
        if (!logisticsInfo) return;
        
        setProcessingId(id);
        try {
            const res = await fetch(`${API_BASE_URL}/hq/supply/orders/${id}/ship`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ logistics_info: logisticsInfo })
            });
            if (res.ok) {
                alert("发货成功！");
                fetchOrders();
            }
        } catch (e) { alert("操作失败"); }
        setProcessingId(null);
    };

    if (loading) return <div className="p-8"><Loader2 className="animate-spin"/> 加载中...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Package className="text-indigo-600"/> 总部供应链订单管理
            </h1>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-4 font-medium text-gray-500">订单号 / 时间</th>
                            <th className="p-4 font-medium text-gray-500">采购基地</th>
                            <th className="p-4 font-medium text-gray-500">商品摘要</th>
                            <th className="p-4 font-medium text-gray-500">金额</th>
                            <th className="p-4 font-medium text-gray-500">状态</th>
                            <th className="p-4 font-medium text-gray-500 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {orders.map(order => (
                            <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4">
                                    <div className="font-mono font-bold text-gray-900">{order.order_no}</div>
                                    <div className="text-xs text-gray-400">{new Date(order.created_at).toLocaleString()}</div>
                                </td>
                                <td className="p-4">
                                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold">
                                        {order.base_name || '未知基地'}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-600 max-w-xs truncate" title={order.items_summary}>
                                    {order.items_summary || '-'}
                                </td>
                                <td className="p-4 font-bold text-gray-900">
                                    ¥{(order.total_amount_cents / 100).toFixed(2)}
                                </td>
                                <td className="p-4">
                                    <StatusBadge status={order.status} />
                                    {order.payment_proof_url && (
                                        <div className="mt-1">
                                            <a href={order.payment_proof_url} target="_blank" className="text-xs text-indigo-600 underline flex items-center gap-1">
                                                <FileText size={10}/> 查看凭证
                                            </a>
                                        </div>
                                    )}
                                </td>
                                <td className="p-4 text-right space-x-2">
                                    {order.status === 'pending_payment' && (
                                        <button 
                                            onClick={() => handleConfirmPayment(order.id)}
                                            disabled={!!processingId}
                                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 disabled:opacity-50"
                                        >
                                            确认收款
                                        </button>
                                    )}
                                    {order.status === 'paid' && (
                                        <button 
                                            onClick={() => handleShip(order.id)}
                                            disabled={!!processingId}
                                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1 ml-auto"
                                        >
                                            <Truck size={12}/> 发货
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {orders.length === 0 && <div className="p-8 text-center text-gray-400">暂无采购订单</div>}
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        pending_payment: "bg-yellow-100 text-yellow-700",
        paid: "bg-blue-100 text-blue-700",
        shipped: "bg-purple-100 text-purple-700",
        completed: "bg-green-100 text-green-700",
    };
    const labels: Record<string, string> = {
        pending_payment: "待付款",
        paid: "待发货",
        shipped: "已发货",
        completed: "已完成",
    };
    return (
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${styles[status] || 'bg-gray-100'}`}>
            {labels[status] || status}
        </span>
    );
}