'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { 
    Plus, Search, Users, Calendar, 
    MoreHorizontal, FileText, CheckCircle, AlertCircle, Clock,
    Trash2, Edit, Upload, User, Tag 
} from 'lucide-react';

// 引入同级目录下的子组件
import CreateOrderDrawer from './CreateOrderDrawer';
import EditOrderDrawer from './EditOrderDrawer';
import PaymentModal from './PaymentModal';

// --- 类型定义 (与后端 OrderDetail 对齐) ---
export interface Order {
    id: string;
    order_no: string;
    type: 'b2b' | 'b2c' | 'b2g';
    status: string;
    customer_name: string;
    contact_name: string;
    
    // 核心业务字段
    event_date: string | null;       
    expected_attendees: number;

    // 财务字段
    total_amount_cents: number;
    paid_amount_cents: number;
    created_at: string;
    payment_status: 'paid' | 'partial' | 'unpaid';

    // ★ 新增字段 (V25.5)
    sales_name?: string;      // 销售归属
    invoice_status?: string;  // unbilled, billing, billed
    contract_url?: string;
}

export default function SalesOrderPage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    
    // --- 状态管理 ---
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('ALL'); // ALL | UNPAID | PAID
    
    // 弹窗控制状态
    const [isCreateOpen, setCreateOpen] = useState(false);
    const [isEditOpen, setEditOpen] = useState(false);
    const [isPayOpen, setPayOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    // --- 数据获取 ---
    const fetchOrders = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/finance/orders`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setOrders(data);
            } else {
                console.error("Failed to fetch orders:", await res.text());
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { fetchOrders(); }, [token]);

    // --- 业务操作 ---
    // 取消订单
    const handleCancel = async (order: Order) => {
        if (!confirm(`确定要取消订单 ${order.order_no} 吗？此操作不可恢复。`)) return;
        
        try {
            const res = await fetch(`${API_BASE_URL}/finance/orders/${order.id}/cancel`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                alert('订单已取消');
                fetchOrders();
            } else {
                alert('取消失败：订单已锁定或已付款');
            }
        } catch (e) { console.error(e); }
    };

    // --- 筛选逻辑 ---
    const filteredOrders = orders.filter(o => {
        if (activeTab === 'ALL') return true;
        if (activeTab === 'UNPAID') return o.payment_status !== 'paid';
        if (activeTab === 'PAID') return o.payment_status === 'paid';
        return true;
    });

    // --- UI 辅助函数 ---
    const fmtMoney = (cents: number) => 
        `¥${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const getTypeBadge = (type: string) => {
        const config: any = {
            'b2b': { label: '企业团建', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
            'b2g': { label: '政务/党建', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100' },
            'b2c': { label: '个人/散客', bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-100' },
        };
        const c = config[type] || { label: '未知', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-100' };

        return (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${c.bg} ${c.text} ${c.border}`}>
                {c.label}
            </span>
        );
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-6">
            
            {/* 1. Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">销售订单</h1>
                    <p className="text-sm text-gray-500 mt-1">管理所有团建合同、研学订单及收款状态。</p>
                </div>
                <button 
                    onClick={() => setCreateOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm shadow-indigo-200 transition-all"
                >
                    <Plus size={18} /> 新建订单
                </button>
            </div>

            {/* 2. Tabs & Search */}
            <div className="flex flex-col md:flex-row justify-between items-center border-b border-gray-100 pb-1 gap-4">
                <div className="flex gap-6 text-sm font-medium text-gray-500">
                    {['ALL', 'UNPAID', 'PAID'].map((tab) => (
                        <button 
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
                                activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-gray-700'
                            }`}
                        >
                            {tab === 'ALL' ? '全部订单' : tab === 'UNPAID' ? '待付款/结算' : '已完成'}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                                {tab === 'ALL' ? orders.length : orders.filter(o => 
                                    tab === 'UNPAID' ? o.payment_status !== 'paid' : o.payment_status === 'paid'
                                ).length}
                            </span>
                        </button>
                    ))}
                </div>
                <div className="relative w-full md:w-64 mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input type="text" placeholder="搜索客户、单号..." className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
            </div>

            {/* 3. Clean Table List */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden min-h-[400px]">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 w-[180px]">活动日期 / 规模</th>
                            <th className="px-6 py-4 w-[240px]">客户信息</th>
                            <th className="px-6 py-4 w-[140px]">销售/发票</th> {/* ★ 新增列 */}
                            <th className="px-6 py-4 text-right">订单金额</th>
                            <th className="px-6 py-4 text-right">回款状态</th>
                            <th className="px-6 py-4 w-[140px] text-center">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr><td colSpan={6} className="p-10 text-center text-gray-400"><Clock className="inline animate-spin mr-2"/>加载数据中...</td></tr>
                        ) : filteredOrders.length === 0 ? (
                            <tr><td colSpan={6} className="p-10 text-center text-gray-400">暂无相关订单</td></tr>
                        ) : (
                            filteredOrders.map((order) => (
                                <tr key={order.id} className="group hover:bg-gray-50/80 transition-colors">
                                    {/* 1. 日期与规模 */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-start gap-3">
                                            <div className="bg-white border border-gray-200 rounded-lg p-1.5 text-center min-w-[48px] shadow-sm">
                                                <div className="text-[10px] text-gray-400 font-bold uppercase">
                                                    {order.event_date ? new Date(order.event_date).toLocaleString('en-US', {month:'short'}) : '--'}
                                                </div>
                                                <div className="text-lg font-bold text-gray-900 leading-none">
                                                    {order.event_date ? new Date(order.event_date).getDate() : '?'}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="mb-1">{getTypeBadge(order.type)}</div>
                                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                                    <Users size={12}/>
                                                    <span className="font-medium">{order.expected_attendees > 0 ? `${order.expected_attendees}人` : '人数未定'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* 2. 客户与单号 */}
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-900 text-[15px] mb-1 truncate max-w-[200px]" title={order.customer_name || order.contact_name}>
                                            {order.customer_name || order.contact_name || '散客'}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs text-gray-400 bg-gray-100 px-1.5 rounded">{order.order_no}</span>
                                        </div>
                                    </td>

                                    {/* 3. ★ 新增：销售与发票状态 */}
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col items-start gap-1.5">
                                            {/* 销售人 */}
                                            <div className="text-xs text-gray-500 flex items-center gap-1">
                                                <User size={12} className="text-gray-400"/> 
                                                <span>{order.sales_name || '未分配'}</span>
                                            </div>
                                            
                                            {/* 发票状态 Badge */}
                                            {order.invoice_status === 'billed' ? (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100">
                                                    已开票
                                                </span>
                                            ) : order.invoice_status === 'billing' ? (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-600 border border-orange-100">
                                                    开票中
                                                </span>
                                            ) : (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-400 border border-gray-200">
                                                    未开票
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* 4. 金额 */}
                                    <td className="px-6 py-4 text-right">
                                        <div className="font-mono font-bold text-gray-900 text-base">
                                            {fmtMoney(order.total_amount_cents)}
                                        </div>
                                        <div className="text-xs text-gray-400">总额</div>
                                    </td>

                                    {/* 5. 回款状态 */}
                                    <td className="px-6 py-4 text-right">
                                        {order.payment_status === 'paid' ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600">
                                                <CheckCircle size={12}/> 已付清
                                            </span>
                                        ) : (
                                            <div className="inline-flex flex-col items-end">
                                                <span className="font-mono font-bold text-orange-600">
                                                    {fmtMoney(order.total_amount_cents - order.paid_amount_cents)}
                                                </span>
                                                <span className="text-[10px] text-orange-400 flex items-center gap-1">
                                                    <AlertCircle size={10}/> 待支付
                                                </span>
                                            </div>
                                        )}
                                    </td>

                                    {/* 6. 操作列 */}
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {/* 只有未完成且未取消的订单可以操作 */}
                                            {order.status !== 'cancelled' && order.payment_status !== 'paid' && (
                                                <>
                                                    {/* 收款按钮 */}
                                                    <button 
                                                        onClick={() => { setSelectedOrder(order); setPayOpen(true); }}
                                                        className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg tooltip"
                                                        title="上传收款凭证"
                                                    >
                                                        <Upload size={16} />
                                                    </button>

                                                    {/* 编辑按钮 (仅限未付款) */}
                                                    {order.paid_amount_cents === 0 && (
                                                        <button 
                                                            onClick={() => { setSelectedOrder(order); setEditOpen(true); }}
                                                            className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"
                                                            title="编辑订单"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                    )}

                                                    {/* 取消按钮 (仅限未付款) */}
                                                    {order.paid_amount_cents === 0 && (
                                                        <button 
                                                            onClick={() => handleCancel(order)}
                                                            className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg"
                                                            title="取消订单"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                            
                                            {/* 已取消状态展示 */}
                                            {order.status === 'cancelled' && (
                                                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">已取消</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* 挂载所有子组件 */}
            <CreateOrderDrawer 
                isOpen={isCreateOpen} 
                onClose={() => setCreateOpen(false)} 
                onSuccess={() => { setCreateOpen(false); fetchOrders(); }} 
            />
            
            <EditOrderDrawer
                order={selectedOrder}
                isOpen={isEditOpen}
                onClose={() => setEditOpen(false)}
                onSuccess={() => { fetchOrders(); }}
            />

            <PaymentModal
                order={selectedOrder}
                isOpen={isPayOpen}
                onClose={() => setPayOpen(false)}
                onSuccess={() => { fetchOrders(); }}
            />
        </div>
    );
}