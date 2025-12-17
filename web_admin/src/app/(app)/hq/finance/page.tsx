'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { 
    TrendingUp, TrendingDown, DollarSign, Activity, 
    PieChart, BarChart3, ArrowUpRight, ArrowDownRight,
    Loader2, Building2
} from 'lucide-react';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend, Cell, PieChart as RePie, Pie 
} from 'recharts';

// 数据类型定义
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
}

export default function HqFinancePage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) fetchDashboard();
    }, [token]);

    const fetchDashboard = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/hq/finance/dashboard`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setData(await res.json());
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600"/></div>;
    if (!data) return <div className="p-8 text-center text-gray-500">暂无财务数据，请检查后端服务。</div>;

    // 格式化金额 (分 -> 元)
    const fmt = (cents: number) => `¥${(cents / 100).toLocaleString('en-US')}`;
    // 格式化万
    const fmtW = (cents: number) => `${(cents / 100 / 10000).toFixed(1)}w`;

    // 构造图表数据
    const chartData = data.trend_labels.map((label, i) => ({
        name: label,
        cash: data.trend_cash_in[i] / 100,
        revenue: data.trend_revenue[i] / 100,
        cost: data.trend_cost[i] / 100,
    }));

    // 构造饼图数据 (模拟)
    const pieData = [
        { name: '学费收入', value: 65, color: '#10b981' }, // Emerald
        { name: '教具销售', value: 25, color: '#3b82f6' }, // Blue
        { name: 'SaaS服务', value: 10, color: '#8b5cf6' }, // Violet
    ];

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-6">
            
            {/* 1. Header & Filters */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">财务驾驶舱 (CFO Cockpit)</h1>
                    <p className="text-sm text-gray-500 mt-1">集团资金流向与经营状况实时监控</p>
                </div>
                <div className="flex gap-2">
                    <select className="bg-white border border-gray-200 text-sm rounded-lg px-3 py-2 outline-none font-medium">
                        <option>本月 (2025-12)</option>
                        <option>上月 (2025-11)</option>
                        <option>本季度</option>
                    </select>
                    <button onClick={fetchDashboard} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-700">
                        刷新数据
                    </button>
                </div>
            </div>

            {/* 2. Top Cards (The Pulse) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 资金池 (资产) */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <DollarSign size={64} className="text-indigo-600"/>
                    </div>
                    <div className="text-sm font-bold text-gray-500 mb-1">资金池总额 (预收)</div>
                    <div className="text-3xl font-mono font-bold text-gray-900 tracking-tight">{fmt(data.total_prepaid_pool)}</div>
                    <div className="mt-3 flex items-center text-xs font-medium text-indigo-600 bg-indigo-50 w-fit px-2 py-1 rounded">
                        <Activity size={12} className="mr-1"/> 核心资产沉淀
                    </div>
                </div>

                {/* 现金进账 (Cash In) */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="text-sm font-bold text-gray-500 mb-1">本月现金进账</div>
                    <div className="text-3xl font-mono font-bold text-emerald-600 tracking-tight">{fmt(data.month_cash_in)}</div>
                    <div className="mt-3 flex items-center text-xs font-bold text-emerald-600">
                        <ArrowUpRight size={14} className="mr-1"/>
                        <span>+12.5%</span> <span className="text-gray-400 font-normal ml-1">vs 上月</span>
                    </div>
                </div>

                {/* 确认营收 (Revenue) */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="text-sm font-bold text-gray-500 mb-1">本月确认营收 (消课)</div>
                    <div className="text-3xl font-mono font-bold text-blue-600 tracking-tight">{fmt(data.month_revenue)}</div>
                    <div className="mt-3 flex items-center text-xs font-bold text-blue-600">
                        <ArrowUpRight size={14} className="mr-1"/>
                        <span>+5.2%</span> <span className="text-gray-400 font-normal ml-1">交付能力提升</span>
                    </div>
                </div>

                {/* 运营支出 (Cost) */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="text-sm font-bold text-gray-500 mb-1">本月总支出</div>
                    <div className="text-3xl font-mono font-bold text-rose-600 tracking-tight">{fmt(data.month_cost)}</div>
                    <div className="mt-3 flex items-center text-xs font-bold text-emerald-600">
                        <ArrowDownRight size={14} className="mr-1"/>
                        <span>-2.1%</span> <span className="text-gray-400 font-normal ml-1">成本控制优化</span>
                    </div>
                </div>
            </div>

            {/* 3. Middle Section: Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 趋势图 (占 2/3) */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <TrendingUp className="text-indigo-600" size={20}/> 集团经营趋势 (近半年)
                        </h3>
                        <div className="flex gap-4 text-xs font-bold">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> 现金流</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> 消课营收</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400"></span> 支出成本</span>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} dy={10}/>
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} tickFormatter={(val)=>`${val/10000}w`}/>
                                <Tooltip 
                                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                                    formatter={(val: number) => `¥${val.toLocaleString()}`}
                                />
                                <Area type="monotone" dataKey="cash" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCash)" name="现金流" />
                                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" name="营收" />
                                <Area type="monotone" dataKey="cost" stroke="#fb7185" strokeWidth={2} strokeDasharray="4 4" fill="none" name="支出" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 构成图 (占 1/3) */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                    <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <PieChart className="text-indigo-600" size={20}/> 收入结构分析
                    </h3>
                    <div className="flex-1 flex items-center justify-center relative">
                        <ResponsiveContainer width="100%" height={250}>
                            <RePie width={400} height={400}>
                                <Pie
                                    data={pieData}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </RePie>
                        </ResponsiveContainer>
                        {/* 中心文字 */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-bold text-gray-900">100%</span>
                            <span className="text-xs text-gray-400">营收构成</span>
                        </div>
                    </div>
                    <div className="space-y-3 mt-4">
                        {pieData.map(d => (
                            <div key={d.name} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full" style={{backgroundColor: d.color}}></span>
                                    <span className="text-gray-600">{d.name}</span>
                                </div>
                                <span className="font-bold text-gray-900">{d.value}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 4. Bottom: Base Rankings */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <BarChart3 className="text-indigo-600" size={20}/> 基地业绩龙虎榜 (Top 5)
                    </h3>
                    <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700">查看完整报表 &rarr;</button>
                </div>
                <table className="w-full text-left text-sm">
                    <thead className="text-gray-500 font-medium border-b border-gray-100 bg-white">
                        <tr>
                            <th className="px-6 py-4 w-16">排名</th>
                            <th className="px-6 py-4">基地名称</th>
                            <th className="px-6 py-4 text-right">总营收 (Total Income)</th>
                            <th className="px-6 py-4 text-right">利润率 (Margin)</th>
                            <th className="px-6 py-4 text-center">状态</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {data.base_rankings.map((base, idx) => (
                            <tr key={base.base_id} className="hover:bg-gray-50/80 transition-colors">
                                <td className="px-6 py-4">
                                    <span className={`flex items-center justify-center w-6 h-6 rounded font-bold text-xs 
                                        ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : 
                                          idx === 1 ? 'bg-gray-100 text-gray-700' : 
                                          idx === 2 ? 'bg-orange-100 text-orange-700' : 'text-gray-400'}`}>
                                        {idx + 1}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-bold text-gray-900 flex items-center gap-2">
                                    <Building2 size={16} className="text-gray-300"/>
                                    {base.base_name}
                                </td>
                                <td className="px-6 py-4 text-right font-mono font-medium text-gray-700">
                                    {fmt(base.total_income)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${base.profit_margin > 0.2 ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                                        {(base.profit_margin * 100).toFixed(1)}%
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className="text-xs text-gray-400">正常运营</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

        </div>
    );
}