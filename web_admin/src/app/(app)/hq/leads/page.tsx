/*
 * 总部线索管理 - HQ Lead Management
 * 路径: /hq/leads
 * 功能: 查看所有基地的线索汇总和详情
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import {
    Target, Search, Building2, TrendingUp, Users,
    Star, Phone, Clock, Filter
} from 'lucide-react';

interface LeadSummary {
    id: string;
    contact_name: string;
    phone_number: string;
    child_name: string | null;
    child_age: number | null;
    source: string | null;
    status: string;
    quality_score: number | null;
    base_id: string;
    base_name: string;
    assigned_to_name: string | null;
    next_follow_up_at: string | null;
    created_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; bgColor: string }> = {
    new: { label: '新线索', color: 'text-purple-700', bgColor: 'bg-purple-100' },
    contacted: { label: '已联系', color: 'text-pink-700', bgColor: 'bg-pink-100' },
    qualified: { label: '已评估', color: 'text-blue-700', bgColor: 'bg-blue-100' },
    trial_scheduled: { label: '待试听', color: 'text-green-700', bgColor: 'bg-green-100' },
    converted: { label: '已转化', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
    lost: { label: '已流失', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

export default function HqLeadsPage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const API = API_BASE_URL;

    const [leads, setLeads] = useState<LeadSummary[]>([]);
    const [bases, setBases] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [baseFilter, setBaseFilter] = useState<string>('all');

    // 加载基地列表和线索数据
    useEffect(() => {
        const fetchData = async () => {
            if (!token) return;
            setIsLoading(true);
            try {
                // 加载基地列表
                const basesRes = await fetch(`${API}/hq/bases`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (basesRes.ok) {
                    const basesData = await basesRes.json();
                    setBases(basesData);
                }

                // 加载所有线索（总部视角 - 这个API需要在后端添加）
                // 临时方案：遍历每个基地获取线索
                const allLeads: LeadSummary[] = [];
                for (const base of bases) {
                    try {
                        // 注意：这里需要后端支持跨基地查询，或者提供总部专用的线索API
                        // 暂时用这个方案演示
                        const leadsRes = await fetch(`${API}/hq/leads?base_id=${base.id}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (leadsRes.ok) {
                            const leadsData = await leadsRes.json();
                            allLeads.push(...leadsData);
                        }
                    } catch (e) {
                        console.error(`Failed to fetch leads for base ${base.id}:`, e);
                    }
                }
                setLeads(allLeads);
            } catch (e) {
                console.error('Failed to fetch data:', e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [token, bases.length]);

    // 筛选
    const filteredLeads = useMemo(() => {
        let result = leads;

        // 状态筛选
        if (statusFilter !== 'all') {
            result = result.filter(l => l.status === statusFilter);
        }

        // 基地筛选
        if (baseFilter !== 'all') {
            result = result.filter(l => l.base_id === baseFilter);
        }

        // 搜索
        const q = searchQuery.toLowerCase();
        if (q) {
            result = result.filter(l =>
                l.contact_name.toLowerCase().includes(q) ||
                l.phone_number.includes(q) ||
                (l.child_name && l.child_name.toLowerCase().includes(q))
            );
        }

        return result;
    }, [leads, statusFilter, baseFilter, searchQuery]);

    // 统计
    const stats = useMemo(() => ({
        total: leads.length,
        new: leads.filter(l => l.status === 'new').length,
        contacted: leads.filter(l => l.status === 'contacted').length,
        qualified: leads.filter(l => l.status === 'qualified').length,
        converted: leads.filter(l => l.status === 'converted').length,
        conversionRate: leads.length > 0
            ? ((leads.filter(l => l.status === 'converted').length / leads.length) * 100).toFixed(1)
            : '0',
    }), [leads]);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">

            {/* Header with Stats */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                    <Target className="text-purple-600" size={32} /> 客户管理（总部视角）
                </h1>

                {/* KPI Cards */}
                <div className="grid grid-cols-5 gap-4 mt-6">
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
                        <div className="text-sm text-purple-600 mb-1">总线索数</div>
                        <div className="text-3xl font-bold text-purple-900">{stats.total}</div>
                    </div>
                    <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-4">
                        <div className="text-sm text-pink-600 mb-1">已联系</div>
                        <div className="text-3xl font-bold text-pink-900">{stats.contacted}</div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
                        <div className="text-sm text-blue-600 mb-1">已评估</div>
                        <div className="text-3xl font-bold text-blue-900">{stats.qualified}</div>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4">
                        <div className="text-sm text-emerald-600 mb-1">已转化</div>
                        <div className="text-3xl font-bold text-emerald-900">{stats.converted}</div>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4">
                        <div className="text-sm text-amber-600 mb-1">转化率</div>
                        <div className="text-3xl font-bold text-amber-900">{stats.conversionRate}%</div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-4">
                <div className="flex gap-4">
                    {/* 搜索 */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="搜索联系人/手机号/孩子姓名..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                    </div>

                    {/* 基地筛选 */}
                    <select
                        value={baseFilter}
                        onChange={e => setBaseFilter(e.target.value)}
                        className="px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                        <option value="all">全部基地</option>
                        {bases.map(base => (
                            <option key={base.id} value={base.id}>{base.name}</option>
                        ))}
                    </select>
                </div>

                {/* 状态筛选 */}
                <div className="flex gap-2">
                    {[
                        { value: 'all', label: '全部' },
                        { value: 'new', label: '新线索' },
                        { value: 'contacted', label: '已联系' },
                        { value: 'qualified', label: '已评估' },
                        { value: 'converted', label: '已转化' },
                        { value: 'lost', label: '已流失' },
                    ].map(filter => (
                        <button
                            key={filter.value}
                            onClick={() => setStatusFilter(filter.value)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === filter.value
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Leads Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-medium uppercase text-xs">
                        <tr>
                            <th className="px-6 py-4">联系人</th>
                            <th className="px-6 py-4">孩子</th>
                            <th className="px-6 py-4">所属基地</th>
                            <th className="px-6 py-4">来源/质量</th>
                            <th className="px-6 py-4">状态</th>
                            <th className="px-6 py-4">负责人</th>
                            <th className="px-6 py-4">创建时间</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {isLoading ? (
                            <tr><td colSpan={7} className="p-20 text-cent text-gray-400">加载中...</td></tr>
                        ) : filteredLeads.length === 0 ? (
                            <tr><td colSpan={7} className="p-20 text-center text-gray-400">暂无数据</td></tr>
                        ) : (
                            filteredLeads.map(lead => {
                                const statusInfo = STATUS_MAP[lead.status] || STATUS_MAP.new;

                                return (
                                    <tr key={lead.id} className="hover:bg-purple-50/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">{lead.contact_name}</div>
                                            <div className="flex items-center gap-1 text-xs text-gray-500 font-mono mt-1">
                                                <Phone size={10} /> {lead.phone_number}
                                            </div>
                                        </td>

                                        <td className="px-6 py-4">
                                            {lead.child_name ? (
                                                <div>
                                                    <div className="text-gray-900">{lead.child_name}</div>
                                                    <div className="text-xs text-gray-500">{lead.child_age ? `${lead.child_age}岁` : '-'}</div>
                                                </div>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1 text-gray-700">
                                                <Building2 size={14} className="text-gray-400" />
                                                {lead.base_name}
                                            </div>
                                        </td>

                                        <td className="px-6 py-4">
                                            <div className="text-gray-700">{lead.source || '-'}</div>
                                            {lead.quality_score && (
                                                <div className="flex gap-0.5 mt-1">
                                                    {[...Array(5)].map((_, i) => (
                                                        <Star
                                                            key={i}
                                                            size={12}
                                                            className={i < lead.quality_score! ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                                                {statusInfo.label}
                                            </span>
                                        </td>

                                        <td className="px-6 py-4 text-gray-700">
                                            {lead.assigned_to_name || <span className="text-gray-300">未分配</span>}
                                        </td>

                                        <td className="px-6 py-4 text-gray-500">
                                            {new Date(lead.created_at).toLocaleDateString('zh-CN')}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
