/*
 * 校区管理: 采购申请与物流追踪 (V17.4 - 校区专用版)
 * 路径: /campus/procurements
 * 功能: 
 * 1. 发起申请 (购物车模式)
 * 2. 查看审批进度
 * 3. ★ 物流追踪 (点击跳转)
 * 4. ★ 确认收货 (入库)
 */
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { 
    Package, Plus, Clock, CheckCircle, XCircle, Truck, 
    Trash2, ShoppingCart, ExternalLink, Box 
} from 'lucide-react';

interface Material { id: string; name_key: string; unit_of_measure: string; }
interface ProcurementOrder { 
    id: string; 
    status: string; 
    submit_note: string;
    created_at: string;
    logistics_company?: string; // ★ 物流公司
    tracking_number?: string;   // ★ 单号
    reject_reason?: string;
}

export default function CampusProcurementPage() {
    const { data: session } = useSession();
    const token = session?.user?.rawToken;
    const API = API_BASE_URL;

    const [materials, setMaterials] = useState<Material[]>([]);
    const [orders, setOrders] = useState<ProcurementOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // 表单状态
    const [selectedMaterialId, setSelectedMaterialId] = useState("");
    const [quantity, setQuantity] = useState("10");
    const [note, setNote] = useState("");
    const [cart, setCart] = useState<{id:string, name:string, unit:string, qty:number}[]>([]);

    // 1. 加载数据
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

    // 2. 购物车逻辑
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
                    submit_note: note || "校区日常采购",
                    items: cart.map(i => ({ material_id: i.id, quantity: i.qty }))
                })
            });
            if (res.ok) {
                alert("✅ 申请已提交");
                setCart([]); setNote(""); fetchData();
            } else alert("提交失败");
        } catch (e) { alert("网络错误"); }
    };

    // 3. 确认收货
    const handleReceive = async (id: string) => {
        if(!confirm("📦 确认已收到实物？系统将自动增加校区库存。")) return;
        try {
            const res = await fetch(`${API}/procurements/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status: 'received' })
            });
            if (res.ok) { fetchData(); } else alert("操作失败");
        } catch(e) { alert("错误"); }
    };

    // 4. 查看物流 (跳转)
    const openTracking = (order: ProcurementOrder) => {
        if (!order.tracking_number) return;
        window.open(`https://www.kuaidi100.com/chaxun?nu=${order.tracking_number}`, '_blank');
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <Package className="text-emerald-600"/> 采购申请
                    </h1>
                    <p className="text-gray-500 mt-2">向总部申请物资，并追踪发货进度。</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* 左侧：填写表单 */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                            <ShoppingCart size={20} className="text-emerald-600"/> 填写申请单
                        </h3>
                        
                        {/* 选材区 */}
                        <div className="flex gap-4 items-end mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex-1">
                                <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase">选择物料</label>
                                <select 
                                    value={selectedMaterialId} 
                                    onChange={e=>setSelectedMaterialId(e.target.value)}
                                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-sm"
                                >
                                    <option value="">-- 请选择 --</option>
                                    {materials.map(m => (
                                        <option key={m.id} value={m.id}>{m.name_key} ({m.unit_of_measure})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-24">
                                <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase">数量</label>
                                <input type="number" value={quantity} onChange={e=>setQuantity(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg text-center"/>
                            </div>
                            <button onClick={addToCart} className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg hover:bg-emerald-700 font-bold text-sm flex items-center gap-2"><Plus size={16}/> 添加</button>
                        </div>

                        {/* 清单区 */}
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
                                                <td className="px-4 py-3 text-center"><span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-xs font-bold">{item.qty} {item.unit}</span></td>
                                                <td className="px-4 py-3 text-right"><button onClick={() => setCart(p=>p.filter((_,i)=>i!==idx))} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="space-y-4">
                            <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="备注说明..." className="w-full p-3 border border-gray-300 rounded-lg text-sm h-24 resize-none"/>
                            <button onClick={handleSubmit} disabled={cart.length === 0} className="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 shadow-md transition-all disabled:opacity-50">提交申请单</button>
                        </div>
                    </div>
                </div>

                {/* 右侧：申请记录 (包含物流查看) */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col h-[700px]">
                    <div className="p-5 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
                        <h3 className="font-bold text-gray-800">📋 我的申请记录</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {isLoading ? <p className="text-center text-gray-400 py-10 text-sm">加载中...</p> : orders.length === 0 ? <p className="text-center text-gray-400 py-10 text-sm">暂无记录</p> : 
                            orders.map(o => (
                                <div key={o.id} className="p-4 border border-gray-100 rounded-xl hover:border-emerald-200 hover:shadow-sm transition-all bg-white group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="text-xs font-mono text-gray-400">#{o.id.slice(0,8)}</div>
                                        <StatusBadge status={o.status}/>
                                    </div>
                                    
                                    <div className="text-sm text-gray-600 line-clamp-2 mb-3">
                                        {o.submit_note || "无备注"}
                                    </div>

                                    {/* (★ 重点: 物流信息显示条) */}
                                    {o.status === 'shipped' && o.tracking_number && (
                                        <div className="mb-3 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
                                                    <Truck size={14}/>
                                                    <span>{o.logistics_company || '快递'}</span>
                                                </div>
                                                <button 
                                                    onClick={() => openTracking(o)}
                                                    className="text-xs bg-white border border-blue-200 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 flex items-center gap-1"
                                                >
                                                    <ExternalLink size={10}/> 查询轨迹
                                                </button>
                                            </div>
                                            <div className="font-mono text-xs text-blue-600 bg-white/50 px-2 py-1 rounded w-fit select-all">
                                                {o.tracking_number}
                                            </div>
                                        </div>
                                    )}

                                    {/* 拒绝原因 */}
                                    {o.status === 'rejected' && o.reject_reason && (
                                        <div className="mb-3 bg-red-50 p-2 rounded text-xs text-red-600 border border-red-100">
                                            原因: {o.reject_reason}
                                        </div>
                                    )}

                                    {/* 确认收货按钮 */}
                                    {o.status === 'shipped' && (
                                        <button 
                                            onClick={() => handleReceive(o.id)}
                                            className="w-full mt-2 bg-emerald-600 text-white py-1.5 rounded text-xs font-bold hover:bg-emerald-700 shadow-sm flex items-center justify-center gap-1"
                                        >
                                            <CheckCircle size={12}/> 确认收货 (入库)
                                        </button>
                                    )}

                                    <div className="text-xs text-gray-400 flex items-center gap-1 mt-2 pt-2 border-t border-gray-50">
                                        <Clock size={12}/> {new Date(o.created_at).toLocaleString()}
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                </div>
            </div>
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