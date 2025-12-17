'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { TrendingUp, Users, AlertTriangle, Wallet, CalendarDays, Clock, BarChart3, PieChart } from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart as RePie, Pie, Cell, Legend 
} from 'recharts';

// 定义接口 (与后端 BaseDashboardFullData 对齐)
interface DashboardData {
    month_revenue: number;
    revenue_growth: number;
    month_headcount: number;
    headcount_growth: number;
    pending_payment_amount: number;
    pending_alerts: number;
    trend_labels: string[];
    trend_headcount: number[];
    trend_revenue: number[];
    customer_composition: { name: string; value: number; color: string }[];
    upcoming_events: { date: string; customer_name: string; type_name: string; headcount: number; }[];
    todo_list: { id: string; title: string; tag: string; tag_color: string; date: string; }[];
}

export default function PrincipalDashboard({ baseName }: { baseName?: string }) {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    // ★ 1. 获取真实数据
    useEffect(() => {
        if (!token) return;
        fetch(`${API_BASE_URL}/base/dashboard/overview`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(json => { setData(json); setLoading(false); })
        .catch(err => { console.error(err); setLoading(false); });
    }, [token]);

    if (loading) return <div className="p-10 text-center text-gray-400 animate-pulse">正在加载运营数据...</div>;
    if (!data) return <div className="p-10 text-center text-gray-400">暂无数据</div>;

    // 格式化金额 (分 -> 万)
    const fmtW = (cents: number) => `¥${(cents / 100 / 10000).toFixed(2)}万`;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">{baseName}运营驾驶舱</h2>
                    <p className="text-gray-500 text-sm mt-1">全校经营数据概览 (数据更新至今日)</p>
                </div>
                <div className="text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1.5 rounded-full border border-purple-100 flex items-center gap-1">
                    👑 校长视图
                </div>
            </div>

            {/* 1. 核心 KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    icon={Wallet} label="本月确认营收" 
                    value={fmtW(data.month_revenue)} 
                    color="emerald" 
                    sub={`环比 +${(data.revenue_growth * 100).toFixed(0)}%`} 
                />
                <StatCard 
                    icon={Users} label="本月接待人数" 
                    value={data.month_headcount} 
                    color="blue" 
                    sub={`新增 +${(data.headcount_growth * 100).toFixed(0)}%`} 
                />
                <StatCard 
                    icon={Clock} label="待回款金额 (AR)" 
                    value={fmtW(data.pending_payment_amount)} 
                    color="orange" 
                    sub="B2B/G 账期中" 
                />
                <StatCard 
                    icon={AlertTriangle} label="待办预警" 
                    value={data.pending_alerts} 
                    color="red" 
                    sub="需立即处理" 
                />
            </div>

            {/* 2. 图表区域 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 左侧：趋势柱状图 */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <BarChart3 className="text-indigo-600" size={20}/> 接待量与营收趋势
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.trend_labels.map((l, i) => ({
                                name: l,
                                people: data.trend_headcount[i],
                                revenue: data.trend_revenue[i] / 10000 // 万
                            }))}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:12, fill:'#9ca3af'}}/>
                                <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} label={{ value: '人数', angle: -90, position: 'insideLeft', fill:'#9ca3af', fontSize:10 }}/>
                                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} unit="万" tick={{fontSize:12, fill:'#9ca3af'}}/>
                                <Tooltip contentStyle={{borderRadius:'8px', border:'none', boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}/>
                                <Legend />
                                <Bar yAxisId="left" dataKey="people" name="接待人数" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20}/>
                                <Bar yAxisId="right" dataKey="revenue" name="营收(万)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20}/>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 右侧：饼图 */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                    <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <PieChart className="text-indigo-600" size={20}/> 客群结构
                    </h3>
                    <div className="flex-1 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <RePie>
                                <Pie data={data.customer_composition} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {data.customer_composition.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                                </Pie>
                                <Tooltip />
                            </RePie>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-gray-900">{data.customer_composition.length}</div>
                                <div className="text-xs text-gray-400">类目</div>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2 mt-4">
                        {data.customer_composition.map(d => (
                            <div key={d.name} className="flex justify-between text-xs">
                                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{backgroundColor:d.color}}></span>{d.name}</span>
                                <span className="font-bold text-gray-700">{d.value} 单</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 3. 底部：日程与待办 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 接待预告 */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <CalendarDays className="text-indigo-600" size={20}/> 未来7天接待
                        </h3>
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{data.upcoming_events.length} 场</span>
                    </div>
                    <div className="space-y-3">
                        {data.upcoming_events.map((evt, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="bg-white border border-gray-200 rounded-lg p-2 text-center min-w-[50px] shadow-sm">
                                        <div className="text-[10px] text-gray-400">{evt.date.split('-')[0]}月</div>
                                        <div className="text-lg font-bold text-gray-900 leading-none">{evt.date.split('-')[1]}</div>
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-800 text-sm">{evt.customer_name}</div>
                                        <div className="text-xs text-gray-500 mt-0.5 flex gap-2">
                                            <span className="bg-blue-100 text-blue-700 px-1.5 rounded-[4px]">{evt.type_name}</span>
                                            <span>预计 {evt.headcount} 人</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {data.upcoming_events.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">近期无接待安排</div>}
                    </div>
                </div>

                {/* 待办事项 */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Clock className="text-orange-600" size={20}/> 待处理事项
                    </h3>
                    <div className="space-y-3">
                        {data.todo_list.map((todo, i) => (
                            <div key={i} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group">
                                <div>
                                    <div className="text-sm font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">{todo.title}</div>
                                    <div className="text-xs text-gray-400 mt-1">{todo.date}</div>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-md 
                                    ${todo.tag_color === 'red' ? 'bg-red-50 text-red-600' : 
                                      todo.tag_color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                    {todo.tag}
                                </span>
                            </div>
                        ))}
                        {data.todo_list.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">🎉 暂无待办事项</div>}
                    </div>
                </div>
            </div>
        </div>
    );
}

// 内部小组件：StatCard
function StatCard({ icon: Icon, label, value, color, sub }: any) {
    const colors: any = {
        emerald: 'bg-emerald-50 text-emerald-600',
        blue: 'bg-blue-50 text-blue-600',
        orange: 'bg-orange-50 text-orange-600',
        red: 'bg-red-50 text-red-600',
    };
    return (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start justify-between group hover:shadow-md transition-all">
            <div>
                <div className="text-xs font-bold text-gray-400 mb-1">{label}</div>
                <div className="text-2xl font-bold text-gray-900 tracking-tight">{value}</div>
                {sub && <div className={`text-[10px] font-bold mt-2 px-2 py-0.5 rounded-full w-fit ${colors[color]}`}>{sub}</div>}
            </div>
            <div className={`p-3 rounded-xl ${colors[color]}`}>
                <Icon size={20} />
            </div>
        </div>
    );
}