'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { 
    Truck, 
    CheckCircle, 
    Clock, 
    Upload, 
    CreditCard, 
    PackageCheck, 
    Loader2,
    Search,
    ExternalLink
} from 'lucide-react';

interface SupplyOrder {
    id: string;
    order_no: string;
    status: 'pending_payment' | 'paid' | 'shipped' | 'completed' | 'cancelled';
    total_amount_cents: number;
    payment_proof_url: string | null;
    logistics_info: string | null; // 物流单号
    created_at: string;
    items_summary: string; // 后端拼接好的 "无人机 x10, 耗材 x5"
}

export default function MySupplyOrdersPage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;

    const [orders, setOrders] = useState<SupplyOrder[]>([]);
    const [loading, setLoading] = useState(true);
    
    // 上传凭证弹窗
    const [uploadingOrder, setUploadingOrder] = useState<SupplyOrder | null>(null);
    const [proofUrl, setProofUrl] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (token) fetchOrders();
    }, [token]);

    const fetchOrders = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/supply/orders`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setOrders(await res.json());
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    // 1. 上传支付凭证
    const handleUploadProof = async () => {
        if (!uploadingOrder || !proofUrl) return;
        setSubmitting(true);
        try {
            // 这里假设您已经有图片上传逻辑拿到了URL，或者只是填入文本
            const res = await fetch(`${API_BASE_URL}/supply/orders/${uploadingOrder.id}/payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ proof_url: proofUrl })
            });

            if (res.ok) {
                alert("✅ 凭证上传成功，等待总部财务审核");
                setUploadingOrder(null);
                fetchOrders();
            } else {
                alert("上传失败");
            }
        } catch (e) { alert("网络错误"); }
        setSubmitting(false);
    };

    // 2. ★★★ 核心修复：确认收货并入库 ★★★
    const handleReceive = async (order: SupplyOrder) => {
        if (!confirm(`📦 确认收到订单 ${order.order_no} 的所有货物吗？\n\n确认后，物资将自动加入您的库存台账。`)) return;
        
        try {
            // 调用我们之前费劲修好的 receive 接口
            const res = await fetch(`${API_BASE_URL}/supply/orders/${order.id}/receive`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                alert("🎉 收货成功！物资已入库。\n请前往 [库存台账] 查看。");
                fetchOrders();
            } else {
                alert("操作失败：可能系统故障");
            }
        } catch (e) { alert("网络错误"); }
    };

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-indigo-600"/></div>;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Truck className="text-indigo-600"/> 我的进货单
                </h1>
                <p className="text-sm text-gray-500 mt-1">查看采购订单状态，上传转账凭证，确认收货入库。</p>
            </div>

            <div className="space-y-4">
                {orders.map(order => (
                    <div key={order.id} className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center gap-3">
                                    <span className="font-mono font-bold text-gray-900">{order.order_no}</span>
                                    <StatusBadge status={order.status}/>
                                </div>
                                <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                    <Clock size={12}/> {new Date(order.created_at).toLocaleString()}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xl font-bold text-orange-600 font-mono">
                                    ¥{(order.total_amount_cents / 100).toFixed(2)}
                                </div>
                                <div className="text-xs text-gray-500">订单总额</div>
                            </div>
                        </div>

                        {/* 商品摘要 */}
                        <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700 mb-4 border border-gray-100">
                            <span className="font-bold text-gray-500 text-xs uppercase mr-2">包含物资:</span>
                            {order.items_summary}
                        </div>

                        {/* 操作区域 (根据状态显示不同按钮) */}
                        <div className="flex justify-end gap-3 pt-3 border-t">
                            
                            {/* 待付款：上传凭证 */}
                            {order.status === 'pending_payment' && (
                                <button 
                                    onClick={() => setUploadingOrder(order)}
                                    className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700"
                                >
                                    <Upload size={16}/> 上传转账凭证
                                </button>
                            )}

                            {/* 待付款但已传凭证：显示等待审核 */}
                            {order.status === 'pending_payment' && order.payment_proof_url && (
                                <span className="flex items-center gap-1 text-sm font-bold text-blue-600 px-3 py-2 bg-blue-50 rounded-lg">
                                    <Clock size={16}/> 财务审核中...
                                </span>
                            )}

                            {/* 已发货：显示物流 + 确认收货 */}
                            {order.status === 'shipped' && (
                                <>
                                    {order.logistics_info && (
                                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-xs font-mono text-gray-600">
                                            <Truck size={14}/>
                                            物流单号: {order.logistics_info}
                                        </div>
                                    )}
                                    <button 
                                        onClick={() => handleReceive(order)}
                                        className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 shadow-sm shadow-green-200"
                                    >
                                        <PackageCheck size={16}/> 确认收货 (入库)
                                    </button>
                                </>
                            )}

                            {/* 已完成 */}
                            {order.status === 'completed' && (
                                <span className="flex items-center gap-1 text-sm font-bold text-gray-400 px-3 py-2">
                                    <CheckCircle size={16}/> 交易已完成
                                </span>
                            )}
                        </div>
                    </div>
                ))}

                {orders.length === 0 && !loading && (
                    <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed text-gray-400">
                        暂无采购记录
                    </div>
                )}
            </div>

            {/* 上传凭证弹窗 */}
            {uploadingOrder && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">上传转账凭证</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            请通过银行对公转账后，将回单截图上传或填入链接。
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">凭证图片 URL</label>
                                <input 
                                    type="text" 
                                    placeholder="https://..."
                                    value={proofUrl} 
                                    onChange={e => setProofUrl(e.target.value)}
                                    className="w-full p-3 border rounded-xl text-sm"
                                />
                                <p className="text-xs text-gray-400 mt-1">这里暂时请填入任意图片链接模拟，实际项目需对接文件上传服务。</p>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setUploadingOrder(null)} className="flex-1 py-2 border rounded-xl font-bold text-gray-600">取消</button>
                            <button 
                                onClick={handleUploadProof}
                                disabled={submitting || !proofUrl} 
                                className="flex-1 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50"
                            >
                                {submitting ? '提交中...' : '确认上传'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// 状态标签组件
function StatusBadge({ status }: { status: string }) {
    const config: any = {
        'pending_payment': { text: '待付款', color: 'bg-orange-50 text-orange-700 border-orange-200' },
        'paid': { text: '待发货', color: 'bg-blue-50 text-blue-700 border-blue-200' },
        'shipped': { text: '运输中', color: 'bg-purple-50 text-purple-700 border-purple-200' },
        'completed': { text: '已完成', color: 'bg-gray-100 text-gray-500 border-gray-200' },
        'cancelled': { text: '已取消', color: 'bg-red-50 text-red-700 border-red-200' },
    };
    const s = config[status] || config['pending_payment'];
    return (
        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${s.color}`}>
            {s.text}
        </span>
    );
}