/*
 * 总部后台: 财务中心 (V15.2 - 业财一体化看板)
 * 路径: /tenant/finance
 * 功能:
 * 1. 经营概览: 总营收、总支出、毛利。
 * 2. 趋势分析: 近 30 天收支曲线 (Recharts)。
 * 3. 流水明细: 每一笔办卡、消课、采购的资金变动。
 * 4. 手动记账: 录入房租、水电等额外支出。
 */
'use client';

import { useState, useEffect, FormEvent, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import {
    PieChart, Activity, TrendingUp, TrendingDown,
    Wallet, Filter, Plus, Calendar as CalendarIcon, Download
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import { API_BASE_URL } from '@/lib/config';

// --- 类型定义 (与后端一致) ---
type TransactionType = 'income' | 'expense' | 'refund' | 'usage' | 'adjustment';
type TransactionCategory = 'membership_sale' | 'procurement_cost' | 'course_revenue' | 'salary' | 'utility' | 'rent' | 'other';

interface FinancialTransaction {
    id: string;
    tenant_id: string;
    base_id: string | null;
    base_name: string | null;
    amount_in_cents: number;
    transaction_type: TransactionType;
    category: TransactionCategory;
    description: string | null;
    created_at: string;
    created_by_name: string | null;
}

interface Base { id: string; name: string; }

// 映射字典
const TYPE_MAP: Record<string, string> = {
    'income': '收入 (收款)',
    'expense': '支出 (成本)',
    'refund': '退款',
    'usage': '确认营收 (消课)',
    'adjustment': '调账'
};

const CATEGORY_MAP: Record<string, string> = {
    'membership_sale': '会员卡销售',
    'procurement_cost': '采购/物料成本',
    'course_revenue': '课时费收入',
    'salary': '人员工资',
    'utility': '水电杂费',
    'rent': '房租物业',
    'other': '其他'
};

export default function FinancePage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const API = API_BASE_URL;

    // --- 状态 ---
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    const [bases, setBases] = useState<Base[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // 筛选
    const [filterBase, setFilterBase] = useState("all");
    const [filterType, setFilterType] = useState("all");

    // 记账弹窗
    const [isModalOpen, setIsModalOpen] = useState(false);

    // --- 1. 数据加载 ---
    const fetchData = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const [txRes, baseRes] = await Promise.all([
                fetch(`${API}/finance/transactions`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API}/bases`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            if (txRes.ok) setTransactions(await txRes.json());
            if (baseRes.ok) setBases(await baseRes.json());
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [token]);

    // --- 2. 数据处理 (统计与图表) ---
    const filteredData = useMemo(() => {
        return transactions.filter(t => {
            if (filterBase !== "all" && t.base_id !== filterBase) return false;
            if (filterType !== "all" && t.transaction_type !== filterType) return false;
            return true;
        });
    }, [transactions, filterBase, filterType]);

    const stats = useMemo(() => {
        let income = 0; // 现金流入 (办卡)
        let revenue = 0; // 确认营收 (消课)
        let expense = 0; // 支出

        filteredData.forEach(t => {
            const amt = t.amount_in_cents;
            if (t.transaction_type === 'income') income += amt;
            if (t.transaction_type === 'usage') revenue += amt;
            if (t.transaction_type === 'expense') expense += amt; // 假设后端存的是正数，这里累加
            if (t.transaction_type === 'refund') income -= Math.abs(amt);
        });

        return {
            cashIn: income / 100,
            revenue: revenue / 100,
            expense: expense / 100,
            grossProfit: (revenue - expense) / 100
        };
    }, [filteredData]);

    // 生成图表数据 (按日期聚合)
    const chartData = useMemo(() => {
        const map = new Map<string, { date: string, income: number, revenue: number, expense: number }>();

        // 初始化近 7 天 (或根据数据范围)
        // 这里简单处理：只聚合已有数据
        transactions.forEach(t => {
            const date = new Date(t.created_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
            if (!map.has(date)) map.set(date, { date, income: 0, revenue: 0, expense: 0 });

            const item = map.get(date)!;
            const val = t.amount_in_cents / 100;

            if (t.transaction_type === 'income') item.income += val;
            if (t.transaction_type === 'usage') item.revenue += val;
            if (t.transaction_type === 'expense') item.expense += val;
        });

        // 转数组并按日期排序 (简易排序，生产环境建议按时间戳)
        return Array.from(map.values()).reverse();
    }, [transactions]);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <Wallet className="text-indigo-600" size={32} /> 财务中心 (Financial Center)
                    </h1>
                    <p className="text-gray-500 mt-2">
                        实时监控资金流向，掌握机构经营状况。
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded ml-2">
                            当前展示: {filterBase === 'all' ? '全部分店' : bases.find(b => b.id === filterBase)?.name}
                        </span>
                    </p>
                </div>
                <div className="flex gap-3">
                    <button onClick={fetchData} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">
                        刷新数据
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center gap-2 shadow-sm"
                    >
                        <Plus size={16} /> 记一笔支出
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard label="总现金收入 (办卡)" value={stats.cashIn} icon={<TrendingUp className="text-green-600" />} color="text-green-600" sub="实际入账资金" />
                <StatCard label="确认营收 (消课)" value={stats.revenue} icon={<Activity className="text-blue-600" />} color="text-blue-600" sub="履约完成收入" />
                <StatCard label="总运营支出" value={stats.expense} icon={<TrendingDown className="text-red-600" />} color="text-red-600" sub="成本与费用" />
                <StatCard
                    label="毛利润"
                    value={stats.grossProfit}
                    icon={<PieChart className={stats.grossProfit >= 0 ? "text-indigo-600" : "text-red-600"} />}
                    color={stats.grossProfit >= 0 ? "text-indigo-600" : "text-red-600"}
                    sub="营收 - 支出"
                />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-80">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-500 mb-4 uppercase">营收趋势分析</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                            <Tooltip />
                            <Legend verticalAlign="top" height={36} />
                            <Area type="monotone" dataKey="revenue" name="消课营收" stroke="#4F46E5" fillOpacity={1} fill="url(#colorRev)" />
                            <Area type="monotone" dataKey="expense" name="支出成本" stroke="#EF4444" fillOpacity={1} fill="url(#colorExp)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
                    <h3 className="text-sm font-bold text-gray-500 mb-4 uppercase">现金流对比</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[{ name: '本期', income: stats.cashIn, out: stats.expense }]}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" hide />
                            <YAxis />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Legend />
                            <Bar dataKey="income" name="现金收入" fill="#10B981" radius={[4, 4, 0, 0]} barSize={60} />
                            <Bar dataKey="out" name="现金支出" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={60} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Filter & List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border rounded-lg text-sm">
                            <Filter size={14} className="text-gray-400" />
                            <select value={filterBase} onChange={e => setFilterBase(e.target.value)} className="bg-transparent outline-none text-gray-700">
                                <option value="all">全部分店</option>
                                {bases.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border rounded-lg text-sm">
                            <Filter size={14} className="text-gray-400" />
                            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-transparent outline-none text-gray-700">
                                <option value="all">所有类型</option>
                                <option value="income">收入 (Income)</option>
                                <option value="usage">营收 (Usage)</option>
                                <option value="expense">支出 (Expense)</option>
                            </select>
                        </div>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600 flex items-center gap-1 text-sm">
                        <Download size={14} /> 导出报表
                    </button>
                </div>

                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 font-medium">
                        <tr>
                            <th className="px-6 py-3">时间</th>
                            <th className="px-6 py-3">类型</th>
                            <th className="px-6 py-3">科目/类目</th>
                            <th className="px-6 py-3">摘要</th>
                            <th className="px-6 py-3">归属分店</th>
                            <th className="px-6 py-3 text-right">金额</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {isLoading ? (
                            <tr><td colSpan={6} className="p-10 text-center text-gray-400">加载中...</td></tr>
                        ) : filteredData.length === 0 ? (
                            <tr><td colSpan={6} className="p-10 text-center text-gray-400">暂无财务流水</td></tr>
                        ) : (
                            filteredData.map(t => (
                                <tr key={t.id} className="hover:bg-gray-50/50">
                                    <td className="px-6 py-3 text-gray-500 font-mono text-xs">
                                        {new Date(t.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-3">
                                        <TransactionBadge type={t.transaction_type} />
                                    </td>
                                    <td className="px-6 py-3 text-gray-700">
                                        {CATEGORY_MAP[t.category] || t.category}
                                    </td>
                                    <td className="px-6 py-3 text-gray-600 max-w-xs truncate" title={t.description || ''}>
                                        {t.description || '-'}
                                        {t.created_by_name && <span className="text-xs text-gray-400 ml-1">({t.created_by_name})</span>}
                                    </td>
                                    <td className="px-6 py-3 text-gray-600">
                                        {t.base_name || '总部'}
                                    </td>
                                    <td className={`px-6 py-3 text-right font-bold font-mono ${t.transaction_type === 'expense' || t.transaction_type === 'refund'
                                            ? 'text-red-600' : 'text-green-600'
                                        }`}>
                                        {t.transaction_type === 'expense' || t.transaction_type === 'refund' ? '-' : '+'}
                                        ¥{(t.amount_in_cents / 100).toFixed(2)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* 记账弹窗 */}
            {isModalOpen && (
                <ManualTransactionModal
                    token={token}
                    bases={bases}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={fetchData}
                />
            )}
        </div>
    );
}

// --- 子组件 ---

function StatCard({ label, value, icon, color, sub }: any) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
                <span className={`text-2xl font-bold font-mono ${color}`}>
                    ¥{value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
            </div>
            <div className="text-sm text-gray-600 font-medium">{label}</div>
            <div className="text-xs text-gray-400 mt-1">{sub}</div>
        </div>
    );
}

function TransactionBadge({ type }: { type: string }) {
    const styles: Record<string, string> = {
        'income': 'bg-green-100 text-green-700',
        'usage': 'bg-blue-100 text-blue-700',
        'expense': 'bg-red-100 text-red-700',
        'refund': 'bg-orange-100 text-orange-700',
        'adjustment': 'bg-gray-100 text-gray-700',
    };
    return (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[type] || 'bg-gray-100'}`}>
            {TYPE_MAP[type] || type}
        </span>
    );
}

// 手动记账弹窗 (简单版)
function ManualTransactionModal({ token, bases, onClose, onSuccess }: any) {
    const [amount, setAmount] = useState("");
    const [type, setType] = useState("expense");
    const [category, setCategory] = useState("other");
    const [desc, setDesc] = useState("");
    const [baseId, setBaseId] = useState(bases[0]?.id || "");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await fetch(`${API_BASE_URL}/finance/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    base_id: baseId || null,
                    amount: parseFloat(amount),
                    transaction_type: type,
                    category: category,
                    description: desc
                })
            });
            onSuccess();
            onClose();
        } catch (e) { alert("记账失败"); } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-bold mb-4">📝 记一笔</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">类型</label>
                            <select value={type} onChange={e => setType(e.target.value)} className="w-full p-2 border rounded">
                                <option value="expense">支出 (Expense)</option>
                                <option value="income">收入 (Income)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">归属分店</label>
                            <select value={baseId} onChange={e => setBaseId(e.target.value)} className="w-full p-2 border rounded">
                                {bases.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">金额 (元)</label>
                        <input type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-2 border rounded text-lg font-bold text-indigo-600" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">科目/类目</label>
                        <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-2 border rounded">
                            <option value="utility">水电杂费</option>
                            <option value="rent">房租物业</option>
                            <option value="salary">员工工资</option>
                            <option value="procurement_cost">采购成本</option>
                            <option value="other">其他</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">摘要备注</label>
                        <input type="text" required value={desc} onChange={e => setDesc(e.target.value)} className="w-full p-2 border rounded" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded">取消</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium">
                            {loading ? '提交中...' : '确认记账'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}