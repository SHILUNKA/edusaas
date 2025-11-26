/*
 * 校区端: 采购申请与收货
 * 路径: /campus/procurement
 */
'use client';

import { API_BASE_URL } from '@/lib/config';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

// --- 类型定义 ---
interface Material {
    id: string;
    name_key: string;
    unit_of_measure: string | null;
}

interface ProcurementOrder {
    id: string;
    status: 'pending' | 'approved' | 'rejected' | 'shipped' | 'received';
    submit_note: string | null;
    reject_reason: string | null;
    created_at: string;
    items?: ProcurementItem[]; // 仅在详情加载后存在
}

interface ProcurementItem {
    id: string;
    material_name: string;
    quantity: number;
    unit: string | null;
}

export default function CampusProcurementPage() {
    const { data: session } = useSession();
    const token = session?.user?.rawToken;

    const [orders, setOrders] = useState<ProcurementOrder[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // --- 表单状态 ---
    const [isCreating, setIsCreating] = useState(false);
    const [submitNote, setSubmitNote] = useState("");
    const [cart, setCart] = useState<{materialId: string, qty: number}[]>([]);
    
    const [selectedMaterialId, setSelectedMaterialId] = useState("");
    const [inputQty, setInputQty] = useState("1");

    // --- 详情模态框 ---
    const [viewingOrder, setViewingOrder] = useState<ProcurementOrder | null>(null);
    const [orderItems, setOrderItems] = useState<ProcurementItem[]>([]);

    // 1. 初始化加载
    useEffect(() => {
        if (!token) return;
        fetchData();
    }, [token]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [ordersRes, matRes] = await Promise.all([
                fetch(`${API_BASE_URL}/procurements`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/materials`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            
            if (ordersRes.ok) setOrders(await ordersRes.json());
            if (matRes.ok) setMaterials(await matRes.json());
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    // 2. 加载订单详情 (点击查看时)
    const fetchOrderDetails = async (orderId: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/procurements/${orderId}/items`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const items = await res.json();
                setOrderItems(items);
            }
        } catch (e) {
            console.error("Failed to load items", e);
        }
    };

    // 3. 提交申请
    const handleSubmitOrder = async () => {
        if (cart.length === 0) return alert("请至少添加一种物料");
        
        try {
            const payload = {
                submit_note: submitNote,
                items: cart.map(i => ({ material_id: i.materialId, quantity: i.qty }))
            };

            const res = await fetch(`${API_BASE_URL}/procurements`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("提交失败");

            alert("采购申请已提交！等待总部审批。");
            setIsCreating(false);
            setCart([]);
            setSubmitNote("");
            fetchData(); // 刷新列表
        } catch (e) {
            alert("提交失败，请重试");
        }
    };

    // 4. 确认收货 (核心业务)
    const handleConfirmReceipt = async (orderId: string) => {
        if (!confirm("确认已收到货？这将自动增加校区库存。")) return;

        try {
            const res = await fetch(`${API_BASE}/procurements/${orderId}/status`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ status: 'received' })
            });

            if (!res.ok) throw new Error("操作失败");
            
            alert("✅ 收货成功！库存已更新。");
            fetchData(); // 刷新状态
        } catch (e) {
            alert("收货失败，请联系总部");
        }
    };

    // 辅助: 购物车逻辑
    const addToCart = () => {
        if (!selectedMaterialId) return;
        const qty = parseInt(inputQty);
        if (qty <= 0) return;

        setCart(prev => [...prev, { materialId: selectedMaterialId, qty }]);
        setSelectedMaterialId("");
        setInputQty("1");
    };

    const getStatusBadge = (status: string) => {
        const map: Record<string, string> = {
            'pending': 'bg-yellow-100 text-yellow-800',
            'approved': 'bg-blue-100 text-blue-800',
            'rejected': 'bg-red-100 text-red-800',
            'shipped': 'bg-purple-100 text-purple-800',
            'received': 'bg-green-100 text-green-800',
        };
        const labels: Record<string, string> = {
            'pending': '⏳ 待审批',
            'approved': '👍 已批准(备货中)',
            'rejected': '❌ 已拒绝',
            'shipped': '🚚 已发货(运输中)',
            'received': '✅ 已入库',
        };
        return <span className={`px-2 py-1 rounded text-xs ${map[status] || 'bg-gray-100'}`}>{labels[status] || status}</span>;
    };

    // 查找物料名
    const getMatName = (id: string) => materials.find(m => m.id === id)?.name_key || id;

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">📦 采购申请与入库</h1>
                <button 
                    onClick={() => setIsCreating(!isCreating)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                >
                    {isCreating ? "取消申请" : "+ 发起采购申请"}
                </button>
            </div>

            {/* --- 新建申请表单 --- */}
            {isCreating && (
                <div className="bg-white p-6 rounded-lg shadow-md mb-8 border-2 border-indigo-100">
                    <h2 className="text-lg font-semibold mb-4">填写采购单</h2>
                    
                    <div className="flex gap-4 mb-4 items-end">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">选择物料</label>
                            <select 
                                value={selectedMaterialId}
                                onChange={e => setSelectedMaterialId(e.target.value)}
                                className="w-full p-2 border rounded"
                            >
                                <option value="">-- 请选择 --</option>
                                {materials.map(m => (
                                    <option key={m.id} value={m.id}>{m.name_key} ({m.unit_of_measure})</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-32">
                            <label className="block text-sm font-medium text-gray-700 mb-1">数量</label>
                            <input 
                                type="number" 
                                value={inputQty}
                                onChange={e => setInputQty(e.target.value)}
                                className="w-full p-2 border rounded"
                                min="1"
                            />
                        </div>
                        <button onClick={addToCart} className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900">添加</button>
                    </div>

                    {/* 购物车列表 */}
                    {cart.length > 0 && (
                        <div className="mb-4 bg-gray-50 p-3 rounded">
                            <h3 className="text-sm font-bold mb-2">已选清单:</h3>
                            <ul className="list-disc pl-5 text-sm">
                                {cart.map((item, idx) => (
                                    <li key={idx}>{getMatName(item.materialId)} x {item.qty}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <textarea 
                        placeholder="备注说明 (可选，例如：急需)" 
                        value={submitNote}
                        onChange={e => setSubmitNote(e.target.value)}
                        className="w-full p-2 border rounded mb-4"
                        rows={2}
                    />

                    <button 
                        onClick={handleSubmitOrder}
                        className="w-full bg-indigo-600 text-white py-2 rounded font-bold hover:bg-indigo-700"
                    >
                        提交申请
                    </button>
                </div>
            )}

            {/* --- 申请记录列表 --- */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-4 font-medium text-gray-500">申请时间</th>
                            <th className="p-4 font-medium text-gray-500">备注</th>
                            <th className="p-4 font-medium text-gray-500">状态</th>
                            <th className="p-4 font-medium text-gray-500">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {orders.map(order => (
                            <tr key={order.id} className="hover:bg-gray-50">
                                <td className="p-4 text-sm">
                                    {new Date(order.created_at).toLocaleDateString()}
                                    <div className="text-xs text-gray-400">{new Date(order.created_at).toLocaleTimeString()}</div>
                                </td>
                                <td className="p-4 text-sm text-gray-600 max-w-xs truncate">{order.submit_note || '-'}</td>
                                <td className="p-4">{getStatusBadge(order.status)}</td>
                                <td className="p-4 space-x-2">
                                    <button 
                                        onClick={() => {
                                            setViewingOrder(order);
                                            fetchOrderDetails(order.id);
                                        }}
                                        className="text-blue-600 hover:underline text-sm"
                                    >
                                        查看详情
                                    </button>

                                    {order.status === 'shipped' && (
                                        <button 
                                            onClick={() => handleConfirmReceipt(order.id)}
                                            className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                                        >
                                            确认收货
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {orders.length === 0 && !isLoading && (
                            <tr><td colSpan={4} className="p-8 text-center text-gray-500">暂无采购申请记录</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* --- 详情弹窗 (Modal) --- */}
            {viewingOrder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 max-w-lg w-full">
                        <h3 className="text-xl font-bold mb-4">采购单详情</h3>
                        <div className="space-y-2 mb-4 text-sm">
                            <p><span className="font-medium">状态：</span> {getStatusBadge(viewingOrder.status)}</p>
                            <p><span className="font-medium">备注：</span> {viewingOrder.submit_note || '无'}</p>
                            {viewingOrder.reject_reason && (
                                <p className="text-red-600"><span className="font-medium">拒绝原因：</span> {viewingOrder.reject_reason}</p>
                            )}
                        </div>
                        
                        <div className="bg-gray-50 p-4 rounded">
                            <h4 className="font-medium mb-2 text-sm border-b pb-2">物品清单</h4>
                            <ul className="space-y-2">
                                {orderItems.map(item => (
                                    <li key={item.id} className="flex justify-between text-sm">
                                        <span>{item.material_name}</span>
                                        <span className="font-mono font-bold">x {item.quantity} {item.unit}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="mt-6 text-right">
                            <button 
                                onClick={() => setViewingOrder(null)}
                                className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}