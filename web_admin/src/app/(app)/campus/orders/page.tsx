/*
 * 校区订单列表页
 * 路径: web_admin/src/app/(app)/campus/orders/page.tsx
 * 职责: 展示销售订单列表，提供筛选和跳转详情入口
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
    Search, Filter, Plus, FileText, 
    MoreHorizontal, ArrowUpDown, Calendar, Loader2 
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/config';
import { CreateOrderModal } from '@/components/finance/CreateOrderModal';

// === 类型定义 (与后端 Rust OrderDetail 保持一致) ===
interface Order {
    id: string;
    order_no: string;
    type: 'b2b' | 'b2c' | 'b2g';
    status: 'Pending' | 'PartialPaid' | 'Paid' | 'Completed' | 'Refunded' | 'Cancelled';
    customer_name: string | null;
    contact_name: string | null;
    total_amount_cents: number;
    paid_amount_cents: number;
    sales_name: string | null;
    event_date: string | null;
    created_at: string;
}

// 状态字典
const STATUS_MAP: Record<string, { label: string; color: string }> = {
    'Pending': { label: '待支付', color: 'bg-yellow-100 text-yellow-800' },
    'PartialPaid': { label: '部分支付', color: 'bg-blue-100 text-blue-800' },
    'Paid': { label: '已支付', color: 'bg-green-100 text-green-800' },
    'Completed': { label: '已完成', color: 'bg-gray-100 text-gray-800' },
    'Refunded': { label: '已退款', color: 'bg-red-100 text-red-800' },
    'Cancelled': { label: '已取消', color: 'bg-gray-100 text-gray-500' },
};

const TYPE_MAP: Record<string, string> = {
    'b2b': '校企合作 (B2B)',
    'b2c': '个人零售 (B2C)',
    'b2g': '政府采购 (B2G)',
};

export default function OrderListPage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    
    // 状态
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    
    // 1. 加载数据
    const fetchOrders = async () => {
        if (!token) return;
        setLoading(true);
        try {
            // 注意: 这里调用的是 Finance 模块的接口，因为它包含了金额信息
            const res = await fetch(`${API_BASE_URL}/finance/orders`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setOrders(data);
            }
        } catch (error) {
            console.error("Failed to fetch orders:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [token]);

    // 2. 前端筛选逻辑
    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            // 搜索: 匹配单号、客户名或销售名
            const matchesSearch = 
                (order.order_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (order.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (order.sales_name || '').toLowerCase().includes(searchTerm.toLowerCase());
            
            // 状态筛选
            const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [orders, searchTerm, statusFilter]);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* --- 顶部 Header --- */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">订单管理</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        管理所有销售订单、研学团与培训合同。
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={fetchOrders}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                    >
                        刷新
                    </button>
                    {/* 这个按钮可以链接到创建订单页，如果有的话 */}
                    <button 
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2 shadow-sm"
                    >
                        <Plus size={16} /> 新建订单
                    </button>
                </div>
            </div>

            {/* --- 筛选工具栏 --- */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="搜索单号 / 客户 / 销售..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                </div>
                
                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-gray-400" />
                    <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-transparent text-sm text-gray-700 font-medium focus:outline-none cursor-pointer"
                    >
                        <option value="all">所有状态</option>
                        {Object.entries(STATUS_MAP).map(([key, val]) => (
                            <option key={key} value={key}>{val.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* --- 数据表格 --- */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4">订单信息</th>
                                <th className="px-6 py-4">类型</th>
                                <th className="px-6 py-4">客户信息</th>
                                <th className="px-6 py-4 text-right">总金额</th>
                                <th className="px-6 py-4 text-right">已付 / 欠款</th>
                                <th className="px-6 py-4">状态</th>
                                <th className="px-6 py-4 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center">
                                        <div className="flex justify-center items-center gap-2 text-gray-400">
                                            <Loader2 className="animate-spin" size={20} /> 加载数据中...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center text-gray-400">
                                        没有找到相关订单
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map((order) => {
                                    const statusConfig = STATUS_MAP[order.status] || { label: order.status, color: 'bg-gray-100' };
                                    const unpaid = order.total_amount_cents - order.paid_amount_cents;
                                    
                                    return (
                                        <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-mono font-medium text-gray-900">{order.order_no}</div>
                                                <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                                    <Calendar size={10} />
                                                    {new Date(order.created_at).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-gray-600">{TYPE_MAP[order.type] || order.type}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{order.customer_name || order.contact_name || '散客'}</div>
                                                <div className="text-xs text-gray-500">销售: {order.sales_name || '-'}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium">
                                                ¥{(order.total_amount_cents / 100).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="text-green-600">已付: ¥{(order.paid_amount_cents / 100).toFixed(2)}</div>
                                                {unpaid > 0 && (
                                                    <div className="text-xs text-red-500 mt-0.5">欠: ¥{(unpaid / 100).toFixed(2)}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                                                    {statusConfig.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {/* 点击跳转到 [id] 详情页 */}
                                                <Link 
                                                    href={`/campus/orders/${order.id}`}
                                                    className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-medium text-xs border border-indigo-200 hover:bg-indigo-50 px-3 py-1.5 rounded transition-colors"
                                                >
                                                    查看详情
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* 简单的底栏统计 */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 text-xs text-gray-500 flex justify-between">
                    <span>共 {filteredOrders.length} 笔订单</span>
                    <span>数据来源: 财务中心</span>
                </div>
            </div>
            {isCreateModalOpen && (
                <CreateOrderModal 
                    onClose={() => setIsCreateModalOpen(false)} 
                    onSuccess={() => {
                        // 创建成功后，刷新列表数据
                        fetchOrders();
                    }} 
                />
            )}
        </div>  
    );
}