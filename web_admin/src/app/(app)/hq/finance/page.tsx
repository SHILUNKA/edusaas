'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import {
    TrendingUp, DollarSign, Activity, Download, Building2,
    ArrowUpRight, Loader2, Wallet, Coins, BarChart3, PieChart
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart as RePie, Pie, Cell
} from 'recharts';

// 🌸 Soft UI Evolution Design System
const SOFT_COLORS = {
    softBlue: '#87CEEB',      // Soft Blue
    softPink: '#FFB6C1',      // Soft Pink  
    softGreen: '#90EE90',     // Soft Green
    lavender: '#A78BFA',      // Soft Purple
    peach: '#FECACA',         // Soft Peach
    background: '#F8FAFC',    // Light background
    cardBg: '#FFFFFF',        // Pure white
    text: '#334155',          // Softer dark text
    textMuted: '#64748B',     // Muted text
    border: '#E2E8F0',        // Light border
};

interface DashboardData {
    total_prepaid_pool: number;
    month_cash_in: number;
    month_revenue: number;
    month_cost: number;
    trend_labels: string[];
    trend_cash_in: number[];
    trend_revenue: number[];
    trend_cost: number[];
    base_rankings: {
        base_id: string;
        base_name: string;
        total_income: number;
        profit_margin: number;
    }[];
    income_composition?: { name: string; value: number; color: string }[];
    total_asset_value?: number;
    total_asset_count?: number;
}

export default function HqFinancePage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;

    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [queryMode, setQueryMode] = useState<'year' | 'quarter' | 'month' | 'custom'>('month');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    useEffect(() => {
        if (token) fetchDashboard();
    }, [token]);

    const buildQueryParams = () => {
        switch (queryMode) {
            case 'year': return `?mode=year&year=${selectedYear}`;
            case 'quarter': return `?mode=quarter&year=${selectedYear}&quarter=${selectedQuarter}`;
            case 'month': return `?mode=month&year=${selectedYear}&month=${selectedMonth}`;
            case 'custom': return customStart && customEnd ? `?mode=custom&start=${customStart}&end=${customEnd}` : '?mode=month';
            default: return '';
        }
    };

    const fetchDashboard = async () => {
        setLoading(true);
        try {
            const queryParams = buildQueryParams();
            const res = await fetch(`${API_BASE_URL}/hq/finance/dashboard${queryParams}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setData(await res.json());
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleExport = () => {
        if (!data) return;
        const exportData = {
            report_time: new Date().toLocaleString(),
            summary: {
                total_prepaid_pool: data.total_prepaid_pool / 100,
                month_cash_in: data.month_cash_in / 100,
                month_revenue: data.month_revenue / 100,
                month_cost: data.month_cost / 100,
                total_assets: data.total_asset_count,
                assets_value: (data.total_asset_value || 0) / 100
            },
            base_rankings: data.base_rankings.map(b => ({
                base_name: b.base_name,
                revenue: b.total_income / 100,
                margin: `${(b.profit_margin * 100).toFixed(1)}%`
            }))
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `HQ_Finance_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    };

    const fmt = (cents: number) => `¥${(cents / 100).toLocaleString()}`;

    const trendData = data?.trend_labels.map((label, idx) => ({
        name: label,
        cash: data.trend_cash_in[idx],
        revenue: data.trend_revenue[idx],
        cost: data.trend_cost[idx]
    })) || [];

    const pieData = data?.income_composition || [];

    if (loading && !data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]" style={{ background: SOFT_COLORS.background }}>
                <Loader2 className="animate-spin mb-4" size={48} style={{ color: SOFT_COLORS.lavender }} />
                <p className="text-sm font-medium" style={{ color: SOFT_COLORS.textMuted }}>温柔加载中...</p>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="min-h-screen" style={{ background: `linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)` }}>
            <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6">

                {/* Header & Controls */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-3xl"
                    style={{
                        background: SOFT_COLORS.cardBg,
                        boxShadow: '0 4px 20px rgba(135, 206, 235, 0.15), 0 1px 3px rgba(0, 0, 0, 0.05)'
                    }}>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight" style={{ color: SOFT_COLORS.text }}>
                            总部财务中心
                        </h1>
                        <p className="text-sm mt-1" style={{ color: SOFT_COLORS.textMuted }}>
                            实时财务数据与分析 · 柔和专业版
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <select value={queryMode} onChange={(e: any) => setQueryMode(e.target.value)}
                            className="px-4 py-2.5 rounded-xl text-sm font-medium outline-none transition-all hover:scale-105"
                            style={{
                                background: `linear-gradient(135deg, ${SOFT_COLORS.softBlue}20, ${SOFT_COLORS.lavender}15)`,
                                color: SOFT_COLORS.text,
                                border: `1.5px solid ${SOFT_COLORS.softBlue}40`,
                                boxShadow: '0 2px 8px rgba(135, 206, 235, 0.1)'
                            }}>
                            <option value="month">按月</option>
                            <option value="quarter">按季度</option>
                            <option value="year">按年</option>
                            <option value="custom">自定义</option>
                        </select>

                        <button onClick={fetchDashboard}
                            className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                            style={{
                                background: `linear-gradient(135deg, ${SOFT_COLORS.softBlue}, ${SOFT_COLORS.lavender})`,
                                color: '#FFF',
                                boxShadow: `0 4px 15px rgba(135, 206, 235, 0.3)`
                            }}>
                            查询
                        </button>
                        <button onClick={handleExport}
                            className="px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all hover:scale-105"
                            style={{
                                background: `linear-gradient(135deg, ${SOFT_COLORS.softPink}, ${SOFT_COLORS.peach})`,
                                color: '#FFF',
                                boxShadow: `0 4px 15px rgba(255, 182, 193, 0.3)`
                            }}>
                            <Download size={16} /> 导出
                        </button>
                    </div>
                </div>

                {/* Soft UI Metric Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    {[
                        { icon: Wallet, label: '资金池总额', value: fmt(data.total_prepaid_pool), gradient: `linear-gradient(135deg, ${SOFT_COLORS.softBlue}30, ${SOFT_COLORS.softBlue}10)`, shadow: 'rgba(135, 206, 235, 0.2)' },
                        { icon: Coins, label: '现金进账', value: fmt(data.month_cash_in), gradient: `linear-gradient(135deg, ${SOFT_COLORS.softGreen}30, ${SOFT_COLORS.softGreen}10)`, shadow: 'rgba(144, 238, 144, 0.2)' },
                        { icon: TrendingUp, label: '确认营收', value: fmt(data.month_revenue), gradient: `linear-gradient(135deg, ${SOFT_COLORS.lavender}30, ${SOFT_COLORS.lavender}10)`, shadow: 'rgba(167, 139, 250, 0.2)' },
                        { icon: Building2, label: '资产数量', value: `${data.total_asset_count || 0}`, gradient: `linear-gradient(135deg, ${SOFT_COLORS.softPink}30, ${SOFT_COLORS.softPink}10)`, shadow: 'rgba(255, 182, 193, 0.2)' }
                    ].map((metric, idx) => (
                        <div key={idx}
                            className="p-6 rounded-3xl transition-all hover:scale-105 cursor-pointer group"
                            style={{
                                background: metric.gradient,
                                backdropFilter: 'blur(10px)',
                                border: '1.5px solid rgba(255, 255, 255, 0.6)',
                                boxShadow: `0 8px 32px ${metric.shadow}, 0 2px 8px rgba(0, 0, 0, 0.05)`
                            }}>
                            <div className="flex items-center justify-between mb-3">
                                <metric.icon size={28} style={{ color: SOFT_COLORS.text, opacity: 0.8 }} className="group-hover:scale-110 transition-transform" />
                            </div>
                            <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: SOFT_COLORS.textMuted }}>{metric.label}</p>
                            <p className="text-3xl font-bold tracking-tight" style={{ color: SOFT_COLORS.text }}>
                                {metric.value}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Charts with Soft Shadows */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Trend Chart */}
                    <div className="lg:col-span-2 p-6 rounded-3xl"
                        style={{
                            background: SOFT_COLORS.cardBg,
                            boxShadow: '0 8px 32px rgba(135, 206, 235, 0.15), 0 2px 8px rgba(0, 0, 0, 0.05)'
                        }}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl" style={{ background: `${SOFT_COLORS.softBlue}20` }}>
                                <BarChart3 size={22} style={{ color: SOFT_COLORS.softBlue }} />
                            </div>
                            <h3 className="font-semibold text-lg" style={{ color: SOFT_COLORS.text }}>
                                经营趋势分析
                            </h3>
                        </div>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData}>
                                    <defs>
                                        <linearGradient id="softBlue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={SOFT_COLORS.softBlue} stopOpacity={0.4} />
                                            <stop offset="95%" stopColor={SOFT_COLORS.softBlue} stopOpacity={0.05} />
                                        </linearGradient>
                                        <linearGradient id="softGreen" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={SOFT_COLORS.softGreen} stopOpacity={0.4} />
                                            <stop offset="95%" stopColor={SOFT_COLORS.softGreen} stopOpacity={0.05} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={SOFT_COLORS.border} vertical={false} />
                                    <XAxis dataKey="name" stroke={SOFT_COLORS.textMuted} tick={{ fontSize: 12 }} />
                                    <YAxis stroke={SOFT_COLORS.textMuted} tick={{ fontSize: 12 }} tickFormatter={(val) => `${val / 10000}w`} />
                                    <Tooltip
                                        contentStyle={{
                                            background: SOFT_COLORS.cardBg,
                                            border: `1.5px solid ${SOFT_COLORS.softBlue}40`,
                                            borderRadius: '16px',
                                            boxShadow: '0 8px 24px rgba(135, 206, 235, 0.2)'
                                        }}
                                        formatter={(val: number) => `¥${(val / 100).toLocaleString()}`}
                                    />
                                    <Area type="monotone" dataKey="cash" stroke={SOFT_COLORS.softGreen} strokeWidth={3} fill="url(#softGreen)" name="现金流" />
                                    <Area type="monotone" dataKey="revenue" stroke={SOFT_COLORS.softBlue} strokeWidth={3} fill="url(#softBlue)" name="营收" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Income Pie */}
                    <div className="p-6 rounded-3xl flex flex-col"
                        style={{
                            background: SOFT_COLORS.cardBg,
                            boxShadow: '0 8px 32px rgba(167, 139, 250, 0.15), 0 2px 8px rgba(0, 0, 0, 0.05)'
                        }}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl" style={{ background: `${SOFT_COLORS.lavender}20` }}>
                                <PieChart size={22} style={{ color: SOFT_COLORS.lavender }} />
                            </div>
                            <h3 className="font-semibold text-lg" style={{ color: SOFT_COLORS.text }}>
                                收入结构
                            </h3>
                        </div>
                        <div className="flex-1 flex items-center justify-center relative min-h-[180px] mb-6">
                            <ResponsiveContainer width="100%" height="100%">
                                <RePie>
                                    <Pie data={pieData} innerRadius={55} outerRadius={80} paddingAngle={6} dataKey="value">
                                        {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => `${value}%`} />
                                </RePie>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-4xl font-bold" style={{ color: SOFT_COLORS.text }}>
                                    {pieData[0]?.value || 0}%
                                </span>
                                <span className="text-xs font-medium" style={{ color: SOFT_COLORS.textMuted }}>主营业务</span>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {pieData.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-xl transition-all hover:scale-105"
                                    style={{ background: `${item.color}10` }}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full" style={{
                                            backgroundColor: item.color,
                                            boxShadow: `0 0 8px ${item.color}60`
                                        }} />
                                        <span className="text-sm font-medium" style={{ color: SOFT_COLORS.text }}>{item.name}</span>
                                    </div>
                                    <span className="text-sm font-bold" style={{ color: SOFT_COLORS.text }}>
                                        {item.value}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Base Rankings */}
                <div className="p-6 rounded-3xl overflow-hidden"
                    style={{
                        background: SOFT_COLORS.cardBg,
                        boxShadow: '0 8px 32px rgba(255, 182, 193, 0.12), 0 2px 8px rgba(0, 0, 0, 0.05)'
                    }}>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-xl" style={{ background: `${SOFT_COLORS.softPink}20` }}>
                            <Building2 size={22} style={{ color: SOFT_COLORS.softPink }} />
                        </div>
                        <h3 className="font-semibold text-lg" style={{ color: SOFT_COLORS.text }}>
                            基地业绩 TOP 5
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b-2" style={{ borderColor: `${SOFT_COLORS.softBlue}30` }}>
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold" style={{ color: SOFT_COLORS.textMuted }}>排名</th>
                                    <th className="px-4 py-3 text-left font-semibold" style={{ color: SOFT_COLORS.textMuted }}>校区</th>
                                    <th className="px-4 py-3 text-right font-semibold" style={{ color: SOFT_COLORS.textMuted }}>营收</th>
                                    <th className="px-4 py-3 text-right font-semibold" style={{ color: SOFT_COLORS.textMuted }}>利润率</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.base_rankings.map((base, idx) => (
                                    <tr key={base.base_id} className="border-b transition-all hover:scale-105"
                                        style={{
                                            borderColor: `${SOFT_COLORS.border}`,
                                            background: idx % 2 === 0 ? `${SOFT_COLORS.softBlue}05` : 'transparent'
                                        }}>
                                        <td className="px-4 py-4">
                                            <span className={`flex items-center justify-center w-10 h-10 rounded-2xl text-sm font-bold shadow-md`}
                                                style={{
                                                    background: idx === 0 ? `linear-gradient(135deg, #FCD34D, #F59E0B)` :
                                                        idx === 1 ? `linear-gradient(135deg, #CBD5E1, #94A3B8)` :
                                                            idx === 2 ? `linear-gradient(135deg, #FB923C, #F97316)` :
                                                                `${SOFT_COLORS.softBlue}20`,
                                                    color: idx < 3 ? '#FFF' : SOFT_COLORS.text
                                                }}>
                                                {idx + 1}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-2">
                                                <Building2 size={16} style={{ color: SOFT_COLORS.textMuted }} />
                                                <span className="font-semibold" style={{ color: SOFT_COLORS.text }}>
                                                    {base.base_name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-right font-bold" style={{ color: SOFT_COLORS.text }}>
                                            {fmt(base.total_income)}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <span className={`px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm`}
                                                style={{
                                                    background: base.profit_margin > 0.2
                                                        ? `linear-gradient(135deg, ${SOFT_COLORS.softGreen}, #34D399)`
                                                        : `linear-gradient(135deg, ${SOFT_COLORS.softPink}, ${SOFT_COLORS.peach})`,
                                                    color: '#FFF'
                                                }}>
                                                {(base.profit_margin * 100).toFixed(1)}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}