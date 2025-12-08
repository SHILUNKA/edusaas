/*
 * 采购管理: 申请、审批与物流闭环 (V17.3 - 完全体)
 * 路径: /tenant/procurements
 * 升级: 增加总部审批与发货(填写物流)功能
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { jwtDecode } from 'jwt-decode';
import { 
    Package, Plus, Clock, CheckCircle, XCircle, Truck, 
    Trash2, ShoppingCart, ExternalLink, Box, X 
} from 'lucide-react';

interface Material { id: string; name_key: string; unit_of_measure: string; }
interface ProcurementOrder { 
    id: string; 
    status: string; 
    submit_note: string;
    created_at: string;
    logistics_company?: string;
    tracking_number?: string;
    base_name?: string; // 总部视角需要知道是哪个分店申请的
}

export default function ProcurementPage() {
    const { data: session } = useSession();
    const token = session?.user?.rawToken;
    const API = API_BASE_URL;

    // --- 1. 权限解析 ---
    const isTenantAdmin = useMemo(() => {
        if (!token) return false;
        try {
            const decoded: any = jwtDecode(token);
            return decoded.roles?.includes('role.tenant.admin');
        } catch { return false; }
    }, [token]);

    const [materials, setMaterials] = useState<Material[]>([]);
    const [orders, setOrders] = useState<ProcurementOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // 表单状态 (基地申请用)
    const [selectedMaterialId, setSelectedMaterialId] = useState("");
    const [quantity, setQuantity] = useState("10");
    const [note, setNote] = useState("");
    const [cart, setCart] = useState<{id:string, name:string, unit:string, qty:number}[]>([]);

    // 弹窗状态 (总部发货用)
    const [shipModalOpen, setShipModalOpen] = useState(false);
    const [targetOrder, setTargetOrder] = useState<ProcurementOrder | null>(null);
    const [logisticsCompany, setLogisticsCompany] = useState("顺丰速运");
    const [trackingNumber, setTrackingNumber] = useState("");

    // 加载数据
    const fetchData = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const [matRes, orderRes] = await Promise.all([
                fetch(`${API}/materials`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API}/procurements`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            if (matRes.ok) setMaterials(await matRes.json());
            if (orderRes.ok) setOrders(await orderRes.json());
        } catch (e) { console.error(e); } 
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchData(); }, [token]);

    // --- 基地操作: 申请 ---
    const addToCart = () => {
        const mat = materials.find(m => m.id === selectedMaterialId);
        if (!mat) return alert("请先选择物料");
        setCart(prev => [...prev, { id: mat.id, name: mat.name_key, unit: mat.unit_of_measure || '个', qty: parseInt(quantity) }]);
        setQuantity("10");
    };

    const handleSubmit = async () => {
        if (cart.length === 0) return alert("清单为空");
        if (!token) return;
        try {
            const res = await fetch(`${API}/procurements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    submit_note: note || "日常采购",
                    items: cart.map(i => ({ material_id: i.id, quantity: i.qty }))
                })
            });
            if (res.ok) {
                alert("✅ 申请已提交");
                setCart([]); setNote(""); fetchData();
            } else alert("提交失败");
        } catch (e) { alert("网络错误"); }
    };

    // --- 总部操作: 审批与发货 ---
    const handleStatusUpdate = async (id: string, status: string, extraData = {}) => {
        if (!token) return;
        try {
            const res = await fetch(`${API}/procurements/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status, ...extraData })
            });
            if (res.ok) {
                // alert("操作成功");
                fetchData();
                setShipModalOpen(false); // 如果是发货弹窗，关闭它
            } else alert("操作失败");
        } catch (e) { alert("错误"); }
    };

    const openShipModal = (order: ProcurementOrder) => {
        setTargetOrder(order);
        setLogisticsCompany("顺丰速运");
        setTrackingNumber("");
        setShipModalOpen(true);
    };

    // 提交发货
    const handleShipSubmit = () => {
        if (!targetOrder) return;
        if (!trackingNumber) return alert("请填写快递单号");
        handleStatusUpdate(targetOrder.id, 'shipped', { 
            logistics_company: logisticsCompany, 
            tracking_number: trackingNumber 
        });
    };

    // 查看物流 (通用)
    const openTracking = (order: ProcurementOrder) => {
        if (!order.tracking_number) return;
        window.open(`https://www.kuaidi100.com/chaxun?nu=${order.tracking_number}`, '_blank');
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <Package className="text-indigo-600"/> 采购申请与入库
                    </h1>
                    <p className="text-gray-500 mt-2">
                        {isTenantAdmin ? '审批各分店的采购申请并安排发货。' : '发起物资采购申请，追踪审批与物流进度。'}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* 左侧：申请表单 (仅基地可见，或者是总部代申请) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                            <ShoppingCart size={20} className="text-indigo-600"/> 填写采购单
                        </h3>
                        <div className="flex gap-4 items-end mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex-1">
                                <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase">选择物料</label>
                                <select value={selectedMaterialId} onChange={e=>setSelectedMaterialId(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-sm">
                                    <option value="">-- 请选择 --</option>
                                    {materials.map(m => <option key={m.id} value={m.id}>{m.name_key} ({m.unit_of_measure})</option>)}
                                </select>
                            </div>
                            <div className="w-24">
                                <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase">数量</label>
                                <input type="number" value={quantity} onChange={e=>setQuantity(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm text-center"/>
                            </div>
                            <button onClick={addToCart} className="bg-black text-white px-5 py-2.5 rounded-lg hover:bg-gray-800 transition-colors font-bold text-sm flex items-center gap-2"><Plus size={16}/> 添加</button>
                        </div>
                        {cart.length > 0 && (
                            <div className="mb-6 border border-gray-200 rounded-xl overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                        <tr><th className="px-4 py-3">物料</th><th className="px-4 py-3 text-center">数量</th><th className="px-4 py-3 text-right">操作</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {cart.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                                                <td className="px-4 py-3 text-center"><span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-bold">{item.qty} {item.unit}</span></td>
                                                <td className="px-4 py-3 text-right"><button onClick={() => setCart(p=>p.filter((_,i)=>i!==idx))} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div className="space-y-4">
                            <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="备注说明..." className="w-full p-3 border border-gray-300 rounded-lg text-sm h-24 resize-none"/>
                            <button onClick={handleSubmit} disabled={cart.length === 0} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-md transition-all disabled:opacity-50">提交申请单</button>
                        </div>
                    </div>
                </div>

                {/* 右侧：申请记录 & 审批流 */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col h-[700px]">
                    <div className="p-5 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
                        <h3 className="font-bold text-gray-800">📋 {isTenantAdmin ? '待办审批' : '我的申请'}</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {isLoading ? <p className="text-center text-gray-400 py-10 text-sm">加载中...</p> : orders.length === 0 ? <p className="text-center text-gray-400 py-10 text-sm">暂无记录</p> : 
                            orders.map(o => (
                                <div key={o.id} className="p-4 border border-gray-100 rounded-xl hover:border-indigo-200 hover:shadow-sm transition-all bg-white group">
                                    
                                    {/* 头部信息 */}
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="text-xs font-mono text-gray-400">#{o.id.slice(0,8)}</div>
                                            {isTenantAdmin && o.base_name && <div className="text-xs font-bold text-indigo-600 mt-0.5">{o.base_name}</div>}
                                        </div>
                                        <StatusBadge status={o.status}/>
                                    </div>
                                    
                                    <div className="text-sm text-gray-600 line-clamp-2 mb-3 bg-gray-50 p-2 rounded">
                                        {o.submit_note || "无备注"}
                                    </div>
                                    
                                    {/* --- 核心: 状态流转操作区 --- */}
                                    
                                    {/* 1. 物流信息 (所有人都看得到) */}
                                    {o.status === 'shipped' && o.tracking_number && (
                                        <div className="mb-3 flex items-center justify-between bg-blue-50 p-2 rounded text-xs text-blue-700">
                                            <div className="flex items-center gap-1">
                                                <Truck size={12}/>
                                                <span className="font-bold">{o.logistics_company}:</span>
                                                <span className="font-mono">{o.tracking_number}</span>
                                            </div>
                                            <button onClick={() => openTracking(o)} className="hover:underline">查询</button>
                                        </div>
                                    )}

                                    {/* 2. 总部操作按钮 (仅总部可见) */}
                                    {isTenantAdmin && (
                                        <div className="flex gap-2 mb-2 pt-2 border-t border-gray-50">
                                            {o.status === 'pending' && (
                                                <>
                                                    <button onClick={() => handleStatusUpdate(o.id, 'approved')} className="flex-1 bg-green-50 text-green-700 py-1.5 rounded text-xs font-bold hover:bg-green-100">批准</button>
                                                    <button onClick={() => handleStatusUpdate(o.id, 'rejected')} className="flex-1 bg-red-50 text-red-700 py-1.5 rounded text-xs font-bold hover:bg-red-100">拒绝</button>
                                                </>
                                            )}
                                            {o.status === 'approved' && (
                                                <button onClick={() => openShipModal(o)} className="w-full bg-indigo-50 text-indigo-700 py-1.5 rounded text-xs font-bold hover:bg-indigo-100 flex items-center justify-center gap-1">
                                                    <Truck size={12}/> 安排发货
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* 3. 基地操作按钮 (仅基地可见) */}
                                    {!isTenantAdmin && o.status === 'shipped' && (
                                        <div className="mb-2 pt-2 border-t border-gray-50">
                                            <button onClick={() => handleStatusUpdate(o.id, 'received')} className="w-full bg-green-600 text-white py-1.5 rounded text-xs font-bold hover:bg-green-700 shadow-sm">
                                                确认收货 (入库)
                                            </button>
                                        </div>
                                    )}

                                    <div className="text-xs text-gray-400 flex items-center gap-1">
                                        <Clock size={12}/> {new Date(o.created_at).toLocaleString()}
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                </div>
            </div>

            {/* --- 发货弹窗 (仅总部) --- */}
            {shipModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900">📦 录入物流信息</h3>
                            <button onClick={() => setShipModalOpen(false)}><X className="text-gray-400 hover:text-gray-600" size={20}/></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">物流公司</label>
                                <select value={logisticsCompany} onChange={e=>setLogisticsCompany(e.target.value)} className="w-full p-2 border rounded">
                                    <option>顺丰速运</option>
                                    <option>京东物流</option>
                                    <option>中通快递</option>
                                    <option>圆通速递</option>
                                    <option>韵达快递</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">快递单号</label>
                                <input 
                                    type="text" 
                                    value={trackingNumber} 
                                    onChange={e=>setTrackingNumber(e.target.value)} 
                                    placeholder="例如: SF123456789"
                                    className="w-full p-2 border rounded font-mono"
                                    autoFocus
                                />
                            </div>
                            <button onClick={handleShipSubmit} className="w-full bg-black text-white py-2.5 rounded-lg font-bold hover:bg-gray-800">
                                确认发货
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const config: any = {
        'pending': { text: '待审批', icon: <Clock size={12}/>, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
        'approved': { text: '待发货', icon: <CheckCircle size={12}/>, color: 'bg-blue-50 text-blue-700 border-blue-200' },
        'shipped': { text: '运输中', icon: <Truck size={12}/>, color: 'bg-purple-50 text-purple-700 border-purple-200' },
        'received': { text: '已入库', icon: <CheckCircle size={12}/>, color: 'bg-green-50 text-green-700 border-green-200' },
        'rejected': { text: '已拒绝', icon: <XCircle size={12}/>, color: 'bg-red-50 text-red-700 border-red-200' },
    };
    const s = config[status] || config['pending'];
    return (
        <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border ${s.color}`}>
            {s.icon} {s.text}
        </span>
    );
}