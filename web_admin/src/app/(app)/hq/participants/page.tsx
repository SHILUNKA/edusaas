/*
 * 总部后台: 学员总览 (V16.5 - 修复 TrendingUp 缺失)
 * 路径: /hq/participants/page.tsx
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import {
    Search, Filter, Users, ChevronRight, UserPlus, CreditCard,
    Calendar, AlertCircle, X, Award, Baby, TrendingUp // (★ 修复: 补上 TrendingUp)
} from 'lucide-react';
import ParticipantDrawer from './ParticipantDrawer';

// --- 类型定义 ---
interface ParticipantDetail {
    id: string;
    name: string;
    date_of_birth: string | null;
    gender: string | null;
    customer_name: string | null;
    customer_phone: string;
    current_total_points: number | null;
    rank_name_key: string | null;
    base_id: string | null;
    base_name: string | null;
    last_class_time: string | null;
}
interface Base { id: string; name: string; }
interface HonorRank { id: string; name_key: string; }
interface ParticipantStats { total_count: number; new_this_month: number; active_members: number; }

export default function TenantParticipantsPage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const API = API_BASE_URL;

    // 数据
    const [allParticipants, setAllParticipants] = useState<ParticipantDetail[]>([]);
    const [bases, setBases] = useState<Base[]>([]);
    const [ranks, setRanks] = useState<HonorRank[]>([]);
    const [stats, setStats] = useState<ParticipantStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // 筛选状态
    const [searchQuery, setSearchQuery] = useState("");
    const [filterBaseId, setFilterBaseId] = useState("all");
    const [filterRank, setFilterRank] = useState("all");
    const [filterAge, setFilterAge] = useState("all");
    const [filterSleep, setFilterSleep] = useState("all");

    // 抽屉
    const [selectedParticipant, setSelectedParticipant] = useState<ParticipantDetail | null>(null);

    // 1. 加载数据
    const fetchData = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const headers = { 'Authorization': `Bearer ${token}` };
            const [pRes, bRes, rRes, sRes] = await Promise.all([
                fetch(`${API}/hq/participants`, { headers }),
                fetch(`${API}/bases`, { headers }),
                fetch(`${API}/honor-ranks`, { headers }),
                fetch(`${API}/hq/participants/stats`, { headers })
            ]);

            if (pRes.ok) setAllParticipants(await pRes.json());
            if (bRes.ok) setBases(await bRes.json());
            if (rRes.ok) setRanks(await rRes.json());
            if (sRes.ok) setStats(await sRes.json());
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchData(); }, [token]);

    // 辅助: 计算年龄
    const getAge = (dobStr: string | null) => {
        if (!dobStr) return -1;
        const dob = new Date(dobStr);
        const diff = Date.now() - dob.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    };

    // 辅助: 计算未上课天数
    const getSleepDays = (lastTimeStr: string | null) => {
        if (!lastTimeStr) return 9999; // 从未上课
        const last = new Date(lastTimeStr).getTime();
        const now = Date.now();
        return Math.floor((now - last) / (1000 * 60 * 60 * 24));
    };

    // 2. 高级筛选逻辑
    const filteredList = useMemo(() => {
        return allParticipants.filter(p => {
            // 基地
            if (filterBaseId !== 'all' && p.base_id !== filterBaseId) return false;

            // 军衔
            if (filterRank !== 'all' && p.rank_name_key !== filterRank) return false;

            // 年龄段
            if (filterAge !== 'all') {
                const age = getAge(p.date_of_birth);
                if (age === -1) return false;
                if (filterAge === 'lt6' && age >= 6) return false;
                if (filterAge === '6-8' && (age < 6 || age > 8)) return false;
                if (filterAge === '9-12' && (age < 9 || age > 12)) return false;
                if (filterAge === '13+' && age < 13) return false;
            }

            // 沉睡状态 (流失预警)
            if (filterSleep !== 'all') {
                const days = getSleepDays(p.last_class_time);
                const limit = parseInt(filterSleep);
                if (days < limit) return false;
            }

            // 搜索
            const q = searchQuery.toLowerCase();
            if (q && !(p.name.toLowerCase().includes(q) || p.customer_phone.includes(q))) return false;

            return true;
        });
    }, [allParticipants, filterBaseId, filterRank, filterAge, filterSleep, searchQuery]);

    // 重置筛选
    const clearFilters = () => {
        setFilterBaseId("all");
        setFilterRank("all");
        setFilterAge("all");
        setFilterSleep("all");
        setSearchQuery("");
    };

    const isFiltering = filterBaseId !== "all" || filterRank !== "all" || filterAge !== "all" || filterSleep !== "all" || searchQuery !== "";

    return (
        <div className="p-8 max-w-7xl mx-auto h-[calc(100vh-64px)] flex flex-col space-y-6">

            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard label="全网学员总数" value={stats?.total_count || 0} icon={<Users className="text-indigo-600" size={24} />} bg="bg-indigo-50 border-indigo-100" />
                <StatCard label="本月新增学员" value={stats?.new_this_month || 0} icon={<UserPlus className="text-green-600" size={24} />} bg="bg-green-50 border-green-100" trend="招生活跃度" />
                <StatCard label="付费会员数" value={stats?.active_members || 0} icon={<CreditCard className="text-amber-600" size={24} />} bg="bg-amber-50 border-amber-100" sub={`转化率: ${stats ? Math.round((stats.active_members / stats.total_count) * 100) : 0}%`} />
            </div>

            {/* --- 高级筛选器 - Soft UI Card --- */}
            <div className="bg-gradient-to-br from-white to-slate-50/30 p-6 rounded-3xl shadow-lg shadow-slate-200/40 border border-slate-100/50 backdrop-blur-sm space-y-4">
                <div className="flex flex-wrap gap-4 items-center">

                    {/* 基地 */}
                    <FilterSelect value={filterBaseId} onChange={setFilterBaseId} label="所属校区" icon={<Filter size={14} />}>
                        <option value="all">全部校区</option>
                        {bases.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </FilterSelect>

                    {/* 军衔 */}
                    <FilterSelect value={filterRank} onChange={setFilterRank} label="荣誉军衔" icon={<Award size={14} className="text-amber-500" />}>
                        <option value="all">全部军衔</option>
                        {ranks.map(r => <option key={r.id} value={r.name_key}>{r.name_key}</option>)}
                    </FilterSelect>

                    {/* 年龄 */}
                    <FilterSelect value={filterAge} onChange={setFilterAge} label="年龄段" icon={<Baby size={14} className="text-pink-500" />}>
                        <option value="all">全部年龄</option>
                        <option value="lt6">&lt; 6 岁 (幼儿)</option>
                        <option value="6-8">6 - 8 岁 (低龄)</option>
                        <option value="9-12">9 - 12 岁 (中高龄)</option>
                        <option value="13+">13 岁以上 (青少年)</option>
                    </FilterSelect>

                    {/* 沉睡 (流失预警) */}
                    <FilterSelect value={filterSleep} onChange={setFilterSleep} label="流失预警" icon={<AlertCircle size={14} className="text-red-500" />} isWarning={filterSleep !== 'all'}>
                        <option value="all">所有状态</option>
                        <option value="30">超过 30 天未上课</option>
                        <option value="60">超过 60 天未上课</option>
                        <option value="90">超过 90 天 (深度沉睡)</option>
                    </FilterSelect>

                    {/* 搜索框 - Soft UI */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-4 top-3 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="搜索姓名或手机..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-sky-400/50 focus:border-sky-400 outline-none bg-white/80 backdrop-blur-sm shadow-sm transition-all"
                        />
                    </div>

                    {/* 重置 - Soft Button */}
                    {isFiltering && (
                        <button onClick={clearFilters} className="text-sm text-slate-500 hover:text-sky-600 flex items-center gap-1 px-3 py-2 rounded-2xl hover:bg-sky-50 transition-all font-medium">
                            <X size={14} /> 重置
                        </button>
                    )}
                </div>
            </div>

            {/* 列表 - Soft UI Card */}
            <div className="bg-gradient-to-br from-white to-slate-50/20 rounded-3xl shadow-lg shadow-slate-200/40 border border-slate-100/50 backdrop-blur-sm flex-1 overflow-hidden flex flex-col">
                <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-slate-100 text-xs text-slate-600 flex justify-between font-semibold">
                    <span>共找到 {filteredList.length} 名学员</span>
                    {filterSleep !== 'all' && <span className="text-red-600 font-bold flex items-center gap-1"><AlertCircle size={14} /> 正在查看流失风险用户</span>}
                </div>
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left">
                        <thead className="bg-white border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4">学员信息</th>
                                <th className="px-6 py-4">归属校区</th>
                                <th className="px-6 py-4">家长联系方式</th>
                                <th className="px-6 py-4">成长积分/军衔</th>
                                <th className="px-6 py-4">最近上课</th>
                                <th className="px-6 py-4 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredList.map(p => {
                                const sleepDays = getSleepDays(p.last_class_time);
                                const isSleeping = sleepDays >= 30;

                                return (
                                    <tr key={p.id} className={`hover:bg-indigo-50/30 transition-colors group cursor-pointer ${isSleeping ? 'bg-red-50/30' : ''}`} onClick={() => setSelectedParticipant(p)}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${isSleeping ? 'bg-gray-400' : 'bg-indigo-500'} shadow-sm`}>
                                                    {p.name[0]}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900 flex items-center gap-2">
                                                        {p.name}
                                                        {isSleeping && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 rounded border border-red-200">沉睡 {sleepDays} 天</span>}
                                                    </div>
                                                    <div className="text-xs text-gray-500">{getAge(p.date_of_birth) > 0 ? `${getAge(p.date_of_birth)}岁` : '年龄未知'} · {p.gender || '-'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700">{p.base_name || '总部'}</td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-900 font-medium">{p.customer_name}</div>
                                            <div className="text-xs text-gray-500 font-mono">{p.customer_phone}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                                                Lv.{p.rank_name_key || 'N/A'} ({p.current_total_points || 0})
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {p.last_class_time ? new Date(p.last_class_time).toLocaleDateString() : <span className="text-gray-300">从未上课</span>}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <ChevronRight size={18} className="text-gray-300 group-hover:text-indigo-500 inline-block" />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedParticipant && <ParticipantDrawer participant={selectedParticipant} onClose={() => setSelectedParticipant(null)} />}
        </div>
    );
}

// Soft UI StatCard Component
function StatCard({ label, value, icon, bg, trend, sub }: any) {
    // Determine color scheme based on icon type
    const colorScheme = bg.includes('indigo')
        ? { gradient: 'from-indigo-50 to-purple-50', shadow: 'shadow-indigo-200/40', border: 'border-indigo-100/50', iconBg: 'from-indigo-100 to-purple-100' }
        : bg.includes('green')
            ? { gradient: 'from-emerald-50 to-teal-50', shadow: 'shadow-emerald-200/40', border: 'border-emerald-100/50', iconBg: 'from-emerald-100 to-teal-100' }
            : { gradient: 'from-amber-50 to-orange-50', shadow: 'shadow-amber-200/40', border: 'border-amber-100/50', iconBg: 'from-amber-100 to-orange-100' };

    return (
        <div className={`p-6 rounded-3xl border ${colorScheme.border} shadow-lg ${colorScheme.shadow} bg-gradient-to-br ${colorScheme.gradient} backdrop-blur-sm flex items-start justify-between hover:scale-[1.02] transition-all duration-300 group cursor-pointer`}>
            <div>
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">{label}</p>
                <h3 className="text-4xl font-extrabold text-slate-800">{value}</h3>
                {(trend || sub) && <div className="flex items-center gap-2 mt-3 text-xs">{trend && <span className="text-emerald-600 font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg"><TrendingUp size={12} /> {trend}</span>}{sub && <span className="text-slate-500 font-medium">{sub}</span>}</div>}
            </div>
            <div className={`p-4 rounded-2xl bg-gradient-to-br ${colorScheme.iconBg} shadow-md shadow-slate-300/30 group-hover:scale-110 transition-transform duration-300`}>{icon}</div>
        </div>
    );
}

function FilterSelect({ value, onChange, label, icon, children, isWarning }: any) {
    return (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl border min-w-[170px] transition-all duration-200 shadow-sm ${isWarning ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200 shadow-red-200/30' : 'bg-white/90 border-slate-200 hover:border-sky-300 hover:shadow-md'}`}>
            {icon}
            <div className="flex-1">
                <div className="text-[10px] text-slate-500 uppercase font-bold leading-none mb-1">{label}</div>
                <select
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className={`bg-transparent outline-none text-sm font-semibold w-full cursor-pointer appearance-none ${isWarning ? 'text-red-700' : 'text-slate-700'}`}
                >
                    {children}
                </select>
            </div>
        </div>
    );
}