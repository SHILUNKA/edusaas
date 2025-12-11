/*
 * 订单详情页 (完整版)
 * 路径: src/app/(app)/campus/orders/[id]/page.tsx
 * 功能: 展示真实订单数据 + 上传凭证 + 自动刷新
 */
'use client'; // ★ 必须标记为客户端组件

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from "next/navigation"; 
import { useSession } from 'next-auth/react';
import { 
    ArrowLeft, Loader2, Printer, Ban, 
    User, Phone, Calendar, CreditCard, ShoppingBag 
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/config';
import { PaymentUploadModal } from "@/components/finance/PaymentUploadModal";

// === 类型定义 (与后端 OrderDetail 对应) ===
interface OrderDetail {
    id: string;
    order_no: string;
    status: 'Pending' | 'PartialPaid' | 'Paid' | 'Completed' | 'Refunded' | 'Cancelled';
    type: string;
    customer_name: string | null;
    contact_name: string | null;
    sales_name: string | null;
    total_amount_cents: number;
    paid_amount_cents: number;
    created_at: string;
    event_date: string | null;
}

// 状态样式映射
const STATUS_STYLES: Record<string, string> = {
    'Pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'PartialPaid': 'bg-blue-100 text-blue-800 border-blue-200',
    'Paid': 'bg-green-100 text-green-800 border-green-200',
    'Completed': 'bg-gray-100 text-gray-800 border-gray-200',
    'Refunded': 'bg-red-100 text-red-800 border-red-200',
    'Cancelled': 'bg-gray-50 text-gray-500 border-gray-200',
};

const STATUS_LABELS: Record<string, string> = {
    'Pending': '待支付',
    'PartialPaid': '部分支付',
    'Paid': '已支付',
    'Completed': '已完成',
    'Refunded': '已退款',
    'Cancelled': '已取消',
};

export default function OrderDetailPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const orderId = params.id; 

    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState(true);

    // 1. 获取详情数据
    const fetchOrder = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            // 调用 Finance 列表接口，并加上 ?id=xxx 过滤
            const res = await fetch(`${API_BASE_URL}/finance/orders?id=${orderId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
                const data = await res.json();
                // ★ 关键: 后端返回的是数组，取第一个
                if (Array.isArray(data) && data.length > 0) {
                    setOrder(data[0]);
                } else {
                    setOrder(null); // 未找到
                }
            }
        } catch (error) {
            console.error("Fetch error:", error);
        } finally {
            setLoading(false);
        }
    }, [token, orderId]);

    useEffect(() => {
        fetchOrder();
    }, [fetchOrder]);

    // 2. 刷新回调 (上传成功后调用)
    const handleRefresh = () => {
        fetchOrder();     // 重新拉取最新数据
        router.refresh(); // 刷新 Next.js 路由缓存
    };

    // --- 渲染逻辑 ---

    if (loading) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center text-gray-400">
                <Loader2 className="animate-spin mb-2" size={32} />
                <p>正在加载订单信息...</p>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="p-10 text-center space-y-4">
                <div className="text-gray-500">未找到 ID 为 {orderId} 的订单</div>
                <button 
                    onClick={() => router.back()}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-700"
                >
                    返回列表
                </button>
            </div>
        );
    }

    // 计算金额
    const totalAmount = order.total_amount_cents / 100;
    const paidAmount = order.paid_amount_cents / 100;
    const dueAmount = totalAmount - paidAmount;
    const statusStyle = STATUS_STYLES[order.status] || 'bg-gray-100 text-gray-800';
    const statusLabel = STATUS_LABELS[order.status] || order.status;

    // 判断是否允许上传凭证 (待支付或部分支付)
    const canUpload = ['Pending', 'PartialPaid'].includes(order.status);

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6 pb-20">
            {/* --- 顶部导航与操作栏 --- */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => router.back()} 
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                        title="返回"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight text-gray-900">订单详情</h1>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyle}`}>
                                {statusLabel}
                            </span>
                        </div>
                        <p className="text-gray-500 text-sm font-mono mt-1 flex items-center gap-2">
                            <span>NO.{order.order_no}</span>
                            <span className="text-gray-300">|</span>
                            <span>{new Date(order.created_at).toLocaleString()}</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 shadow-sm">
                        <Printer size={16} /> 打印小票
                    </button>

                    {/* ★★★ 核心功能：上传凭证按钮 (顶部) ★★★ */}
                    {canUpload && (
                        <PaymentUploadModal 
                            orderId={orderId} 
                            onSuccess={handleRefresh} 
                        />
                    )}

                    {order.status === 'Pending' && (
                        <button className="px-3 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 flex items-center gap-2">
                            <Ban size={16} /> 取消订单
                        </button>
                    )}
                </div>
            </div>

            {/* --- 详情内容区域 (Grid布局) --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 左侧：主要信息 (占2列) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* 客户信息卡片 */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                            <User size={18} className="text-gray-400" />
                            <h3 className="font-semibold text-gray-900">客户信息</h3>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold">客户名称</label>
                                <div className="mt-1 font-medium text-gray-900">{order.customer_name || '散客'}</div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold">联系人</label>
                                <div className="mt-1 font-medium text-gray-900 flex items-center gap-2">
                                    {order.contact_name}
                                    <Phone size={14} className="text-gray-400" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold">归属销售</label>
                                <div className="mt-1 text-gray-700">{order.sales_name || '-'}</div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold">业务日期</label>
                                <div className="mt-1 text-gray-700 flex items-center gap-2">
                                    <Calendar size={14} className="text-gray-400" />
                                    {order.event_date || '-'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 商品明细卡片 (占位) */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                            <ShoppingBag size={18} className="text-gray-400" />
                            <h3 className="font-semibold text-gray-900">服务/商品明细</h3>
                        </div>
                        <div className="p-8 text-center text-gray-500 bg-gray-50/30">
                            <p className="text-sm">暂无详细商品清单数据</p>
                        </div>
                    </div>
                </div>

                {/* 右侧：资金信息 (占1列) */}
                <div className="space-y-6">
                    {/* 结算概览卡片 */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                            <CreditCard size={18} className="text-gray-400" />
                            <h3 className="font-semibold text-gray-900">结算概览</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                                <span className="text-gray-600 font-medium">订单总额</span>
                                <span className="text-2xl font-bold text-gray-900 font-mono">
                                    ¥{totalAmount.toFixed(2)}
                                </span>
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500">已收金额</span>
                                    <span className="font-medium text-green-600 font-mono">
                                        ¥{paidAmount.toFixed(2)}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-1.5">
                                    <div 
                                        className="bg-green-500 h-1.5 rounded-full" 
                                        style={{ width: `${Math.min((paidAmount / totalAmount) * 100, 100)}%` }}
                                    ></div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center text-sm pt-2">
                                <span className="text-gray-500">待收尾款</span>
                                <span className="font-bold text-red-500 font-mono">
                                    ¥{dueAmount.toFixed(2)}
                                </span>
                            </div>
                            
                            {/* 快捷操作区 */}
                            {canUpload && (
                                <div className="pt-6 mt-2 border-t border-gray-100">
                                    <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700 mb-3 leading-relaxed">
                                        💡 收到 B2B 对公转账或家长付款后，请上传截图。财务审核通过后将自动核销欠款。
                                    </div>
                                    <div className="w-full">
                                        <PaymentUploadModal orderId={orderId} onSuccess={handleRefresh} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 这里未来可以放 "支付流水记录" 列表 */}
                </div>
            </div>
        </div>
    );
}