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

    if (loading) return <div className="p-8 flex items-center gap-3"><Loader2 className="animate-spin text-indigo-500" size={24} /> <span className="text-slate-600">加载中...</span></div>;

    return (
        <div className="p-6 max-w-7xl mx-auto min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-indigo-50/20">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center shadow-md shadow-indigo-200/40">
                    <Package className="text-indigo-600" size={24} />
                </div>
                总部供应链订单管理
            </h1>

            <div className="bg-gradient-to-br from-white to-slate-50/30 rounded-3xl shadow-lg shadow-slate-200/40 border border-slate-100 overflow-hidden backdrop-blur-sm">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-slate-100">
                        <tr>
                            <th className="p-4 font-bold text-slate-600 text-xs uppercase tracking-wider">订单号 / 时间</th>
                            <th className="p-4 font-bold text-slate-600 text-xs uppercase tracking-wider">采购基地</th>
                            <th className="p-4 font-bold text-slate-600 text-xs uppercase tracking-wider">商品摘要</th>
                            <th className="p-4 font-bold text-slate-600 text-xs uppercase tracking-wider">金额</th>
                            <th className="p-4 font-bold text-slate-600 text-xs uppercase tracking-wider">状态</th>
                            <th className="p-4 font-bold text-slate-600 text-xs uppercase tracking-wider text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {orders.map(order => (
                            <tr key={order.id} className="hover:bg-gradient-to-r hover:from-indigo-50/30 hover:to-purple-50/20 transition-all duration-200">
                                <td className="p-4">
                                    <div className="font-mono font-bold text-slate-800">{order.order_no}</div>
                                    <div className="text-xs text-slate-500">{new Date(order.created_at).toLocaleString()}</div>
                                </td>
                                <td className="p-4">
                                    <span className="bg-gradient-to-r from-sky-50 to-blue-50 text-blue-700 px-3 py-1.5 rounded-xl text-xs font-bold border border-blue-200/50 shadow-sm">
                                        {order.base_name || '未知基地'}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-600 max-w-xs truncate" title={order.items_summary}>
                                    {order.items_summary || '-'}
                                </td>
                                <td className="p-4 font-bold text-slate-800 font-mono">
                                    ¥{(order.total_amount_cents / 100).toFixed(2)}
                                </td>
                                <td className="p-4">
                                    <StatusBadge status={order.status} />
                                    {order.payment_proof_url && (
                                        <div className="mt-1">
                                            <a href={order.payment_proof_url} target="_blank" className="text-xs text-indigo-600 underline flex items-center gap-1">
                                                <FileText size={10} /> 查看凭证
                                            </a>
                                        </div>
                                    )}
                                </td>
                                <td className="p-4 text-right space-x-2">
                                    {order.status === 'pending_payment' && (
                                        <button
                                            onClick={() => handleConfirmPayment(order.id)}
                                            disabled={!!processingId}
                                            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl text-xs font-bold hover:shadow-lg hover:shadow-emerald-300/50 disabled:opacity-50 transition-all hover:scale-105"
                                        >
                                            确认收款
                                        </button>
                                    )}
                                    {order.status === 'paid' && (
                                        <button
                                            onClick={() => handleShip(order.id)}
                                            disabled={!!processingId}
                                            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl text-xs font-bold hover:shadow-lg hover:shadow-indigo-300/50 disabled:opacity-50 flex items-center gap-1.5 ml-auto transition-all hover:scale-105"
                                        >
                                            <Truck size={12} /> 发货
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

// Soft UI StatusBadge Component
function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        pending_payment: "bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-700 border border-yellow-200/50",
        paid: "bg-gradient-to-r from-sky-100 to-blue-100 text-blue-700 border border-blue-200/50",
        shipped: "bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border border-purple-200/50",
        completed: "bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 border border-emerald-200/50",
    };
    const labels: Record<string, string> = {
        pending_payment: "待付款",
        paid: "待发货",
        shipped: "已发货",
        completed: "已完成",
    };
    return (
        <span className={`px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm ${styles[status] || 'bg-gradient-to-r from-gray-100 to-slate-100 border border-slate-200/50'}`}>
            {labels[status] || status}
        </span>
    );
}