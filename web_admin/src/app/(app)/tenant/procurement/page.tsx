/*
 * 总部端: 供应链审批中心
 * 路径: /tenant/procurement
 */
'use client';

import { API_BASE_URL } from '@/lib/config';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface ProcurementOrder {
    id: string;
    base_name: string;
    applicant_name: string;
    status: 'pending' | 'approved' | 'rejected' | 'shipped' | 'received';
    submit_note: string | null;
    created_at: string;
}

interface ProcurementItem {
    id: string;
    material_name: string;
    quantity: number;
    unit: string | null;
}

export default function TenantProcurementPage() {
    const { data: session } = useSession();
    const token = session?.user?.rawToken;

    const [orders, setOrders] = useState<ProcurementOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // 详情与操作状态
    const [selectedOrder, setSelectedOrder] = useState<ProcurementOrder | null>(null);
    const [orderItems, setOrderItems] = useState<ProcurementItem[]>([]);
    const [rejectReason, setRejectReason] = useState("");

    // 1. 获取所有订单
    useEffect(() => {
        if (token) fetchOrders();
    }, [token]);

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/procurements`, { 
                headers: { 'Authorization': `Bearer ${token}` } 
            });
            if (res.ok) setOrders(await res.json());
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    // 2. 获取详情
    const handleViewDetails = async (order: ProcurementOrder) => {
        setSelectedOrder(order);
        try {
            const res = await fetch(`${API_BASE_URL}/procurements/${order.id}/items`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setOrderItems(await res.json());
        } catch (e) { console.error(e); }
    };

    // 3. 状态更新 (审批/发货)
    const updateStatus = async (status: string, reason?: string) => {
        if (!selectedOrder) return;
        if (!confirm(`确定要将状态更新为 "${status}" 吗？`)) return;

        try {
            const res = await fetch(`${API_BASE_URL}/procurements/${selectedOrder.id}/status`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ 
                    status: status,
                    reject_reason: reason || null
                })
            });

            if (!res.ok) throw new Error("操作失败");
            
            alert("✅ 操作成功");
            setSelectedOrder(null); // 关闭弹窗
            fetchOrders(); // 刷新列表
        } catch (e) {
            alert("更新失败");
        }
    };

    const getStatusBadge = (status: string) => {
        const map: Record<string, string> = {
            'pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
            'approved': 'bg-blue-100 text-blue-800 border-blue-200',
            'rejected': 'bg-red-100 text-red-800 border-red-200',
            'shipped': 'bg-purple-100 text-purple-800 border-purple-200',
            'received': 'bg-green-100 text-green-800 border-green-200',
        };
        return <span className={`px-3 py-1 rounded-full text-xs font-medium border ${map[status]}`}>{status.toUpperCase()}</span>;
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-2">🏢 供应链审批中心</h1>
            <p className="text-gray-500 mb-8">处理各校区的物料采购申请，统筹发货。</p>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-4 text-gray-500 text-sm uppercase">申请校区 / 申请人</th>
                            <th className="p-4 text-gray-500 text-sm uppercase">申请时间</th>
                            <th className="p-4 text-gray-500 text-sm uppercase">状态</th>
                            <th className="p-4 text-gray-500 text-sm uppercase">备注</th>
                            <th className="p-4 text-gray-500 text-sm uppercase text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {orders.map(order => (
                            <tr key={order.id} className="hover:bg-gray-50">
                                <td className="p-4">
                                    <div className="font-medium text-gray-900">{order.base_name}</div>
                                    <div className="text-xs text-gray-500">{order.applicant_name || '未知'}</div>
                                </td>
                                <td className="p-4 text-sm text-gray-600">
                                    {new Date(order.created_at).toLocaleDateString()}
                                </td>
                                <td className="p-4">{getStatusBadge(order.status)}</td>
                                <td className="p-4 text-sm text-gray-500 max-w-xs truncate">
                                    {order.submit_note || '-'}
                                </td>
                                <td className="p-4 text-right">
                                    <button 
                                        onClick={() => handleViewDetails(order)}
                                        className="text-indigo-600 hover:text-indigo-900 font-medium text-sm"
                                    >
                                        审批 / 详情 &rarr;
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* --- 审批详情弹窗 --- */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-900">申请单详情</h3>
                                <p className="text-sm text-gray-500">来自: {selectedOrder.base_name}</p>
                            </div>
                            {getStatusBadge(selectedOrder.status)}
                        </div>

                        {/* 物料清单 */}
                        <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-100">
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">采购清单</h4>
                            <ul className="space-y-2">
                                {orderItems.map(item => (
                                    <li key={item.id} className="flex justify-between items-center bg-white p-2 rounded border border-gray-200">
                                        <span className="font-medium text-gray-700">{item.material_name}</span>
                                        <span className="bg-gray-100 px-2 py-1 rounded text-sm font-mono font-bold">
                                            x {item.quantity} {item.unit}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            {selectedOrder.submit_note && (
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                    <p className="text-xs text-gray-500 mb-1">申请人备注:</p>
                                    <p className="text-sm text-gray-800 bg-yellow-50 p-2 rounded border border-yellow-100">
                                        {selectedOrder.submit_note}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* 操作区 */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                            <button 
                                onClick={() => setSelectedOrder(null)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                            >
                                关闭
                            </button>

                            {/* 状态: Pending -> Approve/Reject */}
                            {selectedOrder.status === 'pending' && (
                                <>
                                    <button 
                                        onClick={() => {
                                            const reason = prompt("请输入拒绝原因:");
                                            if (reason) updateStatus('rejected', reason);
                                        }}
                                        className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-md font-medium"
                                    >
                                        ❌ 拒绝
                                    </button>
                                    <button 
                                        onClick={() => updateStatus('approved')}
                                        className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md font-medium shadow-sm"
                                    >
                                        ✅ 批准采购
                                    </button>
                                </>
                            )}

                            {/* 状态: Approved -> Ship */}
                            {selectedOrder.status === 'approved' && (
                                <button 
                                    onClick={() => updateStatus('shipped')}
                                    className="px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded-md font-medium shadow-sm w-full sm:w-auto"
                                >
                                    🚚 确认发货
                                </button>
                            )}
                            
                            {/* 状态: Shipped -> 等待收货 (只读) */}
                            {selectedOrder.status === 'shipped' && (
                                <span className="text-sm text-gray-500 self-center italic">
                                    已发货，等待校区收货...
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}