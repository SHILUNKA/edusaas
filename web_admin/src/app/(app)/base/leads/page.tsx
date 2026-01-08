/*
 * 基地线索管理 - Lead Management (V18.0 - Soft UI Evolution)
 * 路径: /base/leads
 * 功能: 线索列表、创建、详情、跟进记录
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import {
    Target, Search, Plus, Filter, Phone,
    Calendar, Star, Users, TrendingUp,
    MessageSquare, MoreVertical, Clock, User
} from 'lucide-react';
import LeadDetailDrawer from './LeadDetailDrawer';
import CreateLeadModal from './CreateLeadModal';

// Soft UI Components
import { SoftPageContainer, SoftHeader, SoftButton, SoftCard } from '@/components/ui/SoftUI';
import { SOFT_COLORS } from '@/lib/softui-theme';

interface Lead {
    id: string;
    contact_name: string;
    phone_number: string;
    child_name: string | null;
    child_age: number | null;
    source: string | null;
    status: string;
    quality_score: number | null;
    assigned_to_name: string | null;
    last_contact_at: string | null;
    next_follow_up_at: string | null;
    created_at: string;
    data_source?: 'lead' | 'customer'; // 数据来源标识
    customer_type?: string; // 客户类型（仅 customer）
    lead_source?: string; // 客户来源渠道（仅 customer）
}

const STATUS_MAP: Record<string, { label: string; color: string; bgColor: string }> = {
    // Leads 状态
    new: { label: '新线索', color: 'text-purple-700', bgColor: 'bg-purple-100' },
    contacted: { label: '已联系', color: 'text-pink-700', bgColor: 'bg-pink-100' },
    qualified: { label: '已评估', color: 'text-blue-700', bgColor: 'bg-blue-100' },
    trial_scheduled: { label: '待试听', color: 'text-green-700', bgColor: 'bg-green-100' },
    converted: { label: '已转化', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
    lost: { label: '已流失', color: 'text-gray-700', bgColor: 'bg-gray-100' },

    // Customers 类型（customer_type）
    prospect: { label: '潜在客户', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
    trial: { label: '试听客户', color: 'text-cyan-700', bgColor: 'bg-cyan-100' },
    active: { label: '活跃客户', color: 'text-green-700', bgColor: 'bg-green-100' },
    inactive: { label: '非活跃', color: 'text-orange-700', bgColor: 'bg-orange-100' },
    churned: { label: '已流失', color: 'text-red-700', bgColor: 'bg-red-100' },
};

export default function BaseLeadsPage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const API = API_BASE_URL;

    const [leads, setLeads] = useState<Lead[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // 抽屉和模态框状态
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // 加载数据 - 同时加载 leads 和 customers
    const fetchLeads = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            // 1. 获取线索数据
            const leadsParams = new URLSearchParams();
            if (statusFilter !== 'all') leadsParams.append('status', statusFilter);

            const leadsRes = await fetch(`${API}/base/leads?${leadsParams.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // 2. 获取客户数据
            const customersRes = await fetch(`${API}/customers`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            let combinedData: Lead[] = [];

            // 3. 处理线索数据
            if (leadsRes.ok) {
                const leadsData = await leadsRes.json();
                combinedData = leadsData.map((lead: any) => ({
                    ...lead,
                    data_source: 'lead' as const
                }));
            }

            // 4. 处理客户数据并转换格式
            if (customersRes.ok) {
                const customersData = await customersRes.json();
                const transformedCustomers = customersData.map((customer: any) => ({
                    id: customer.id,
                    contact_name: customer.name || '未知',
                    phone_number: customer.phone_number,
                    child_name: null, // customers表没有孩子信息
                    child_age: null,
                    source: customer.lead_source || '直接客户',
                    status: customer.customer_type || 'prospect', // 使用客户类型作为状态
                    quality_score: null,
                    assigned_to_name: null,
                    last_contact_at: customer.last_contact_at,
                    next_follow_up_at: null,
                    created_at: customer.created_at,
                    data_source: 'customer' as const,
                    customer_type: customer.customer_type,
                    lead_source: customer.lead_source
                }));
                combinedData = [...combinedData, ...transformedCustomers];
            }

            // 5. 按创建时间倒序排序
            combinedData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            // Debug: 打印前3条数据
            console.log('=== 客户管理数据 Debug ===');
            console.log('总数:', combinedData.length);
            console.log('前3条:', combinedData.slice(0, 3).map(d => ({
                name: d.contact_name,
                phone: d.phone_number,
                status: d.status,
                source: d.source,
                data_source: d.data_source,
                customer_type: d.customer_type
            })));

            setLeads(combinedData);
        } catch (e) {
            console.error('Failed to fetch data:', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchLeads(); }, [token, statusFilter]);

    // 搜索和状态过滤
    const filteredLeads = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return leads.filter(lead => {
            // 1. 搜索过滤
            const matchesSearch = !q ||
                lead.contact_name.toLowerCase().includes(q) ||
                lead.phone_number.includes(q) ||
                (lead.child_name && lead.child_name.toLowerCase().includes(q));

            // 2. 状态过滤
            const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [leads, searchQuery, statusFilter]);

    // 统计数据
    const stats = useMemo(() => ({
        total: leads.length,
        new: leads.filter(l => l.status === 'new').length,
        contacted: leads.filter(l => l.status === 'contacted').length,
        qualified: leads.filter(l => l.status === 'qualified').length,
        pendingFollowUp: leads.filter(l => l.next_follow_up_at).length,
    }), [leads]);

    // 格式化日期
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return '今天';
        if (days === 1) return '昨天';
        if (days < 7) return `${days}天前`;
        return date.toLocaleDateString('zh-CN');
    };

    return (
        <SoftPageContainer>
            <SoftHeader
                title="客户管理"
                subtitle={`总数: ${stats.total} | 新增: ${stats.new} | 已联系: ${stats.contacted} | ⭐️ 待跟进: ${stats.pendingFollowUp}`}
                icon={<Target size={32} style={{ color: SOFT_COLORS.lavender }} />}
                variant="purple"
                action={
                    <SoftButton variant="blue" onClick={() => setShowCreateModal(true)} icon={<Plus size={18} />}>
                        新增客户
                    </SoftButton>
                }
            />

            {/* 2. 筛选与搜索栏 */}
            <SoftCard variant="white" padding="sm">
                <div className="flex justify-between items-center">
                    <div className="relative w-96">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="搜索联系人/手机号/孩子姓名..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 p-2 border rounded-lg text-sm focus:ring-2 outline-none"
                            style={{ borderColor: SOFT_COLORS.border }}
                        />
                    </div>

                    {/* 状态筛选 */}
                    <div className="flex gap-2">
                        {[
                            { value: 'all', label: '全部' },
                            { value: 'prospect', label: '💎 潜在客户' },
                            { value: 'new', label: '新线索' },
                            { value: 'contacted', label: '已联系' },
                            { value: 'qualified', label: '已评估' },
                            { value: 'converted', label: '已转化' },
                        ].map(filter => (
                            <button
                                key={filter.value}
                                onClick={() => setStatusFilter(filter.value)}
                                className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all hover:scale-105 ${statusFilter === filter.value
                                        ? 'text-white'
                                        : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                style={statusFilter === filter.value ? {
                                    background: 'linear-gradient(135deg, #A78BFA, #C4B5FD)',
                                    boxShadow: '0 4px 12px rgba(167, 139, 250, 0.3)'
                                } : { background: '#F1F5F9' }}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>
            </SoftCard>

            {/* 3. 线索列表 */}
            <SoftCard variant="white" padding="sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-medium uppercase text-xs">
                        <tr>
                            <th className="px-6 py-4">联系人信息</th>
                            <th className="px-6 py-4">孩子信息</th>
                            <th className="px-6 py-4">来源/质量</th>
                            <th className="px-6 py-4">状态</th>
                            <th className="px-6 py-4">负责人</th>
                            <th className="px-6 py-4">下次跟进</th>
                            <th className="px-6 py-4">创建时间</th>
                            <th className="px-6 py-4 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {isLoading ? (
                            <tr><td colSpan={8} className="p-20 text-center text-gray-400">加载中...</td></tr>
                        ) : filteredLeads.length === 0 ? (
                            <tr><td colSpan={8} className="p-20 text-center text-gray-400">暂无线索数据</td></tr>
                        ) : (
                            filteredLeads.map(lead => {
                                const statusInfo = STATUS_MAP[lead.status] || STATUS_MAP.new;
                                const isUrgentFollowUp = lead.next_follow_up_at && new Date(lead.next_follow_up_at) < new Date();

                                return (
                                    <tr
                                        key={lead.id}
                                        className="hover:bg-purple-50/30 transition-colors group cursor-pointer"
                                        onClick={() => setSelectedLead(lead)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                                                    {lead.contact_name[0]}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900">{lead.contact_name}</div>
                                                    <div className="flex items-center gap-1 text-xs text-gray-500 font-mono">
                                                        <Phone size={10} /> {lead.phone_number}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-6 py-4">
                                            {lead.child_name ? (
                                                <div>
                                                    <div className="font-medium text-gray-900">{lead.child_name}</div>
                                                    <div className="text-xs text-gray-500">{lead.child_age ? `${lead.child_age}岁` : '-'}</div>
                                                </div>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                {/* 数据来源标签 */}
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium inline-block w-fit ${lead.data_source === 'customer'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {lead.data_source === 'customer' ? '客户' : '线索'}
                                                </span>
                                                <div className="text-gray-700 text-sm">{lead.source || '-'}</div>
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
                                            </div>
                                        </td>

                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                                                {statusInfo.label}
                                            </span>
                                        </td>

                                        <td className="px-6 py-4">
                                            {lead.assigned_to_name ? (
                                                <div className="flex items-center gap-1">
                                                    <User size={14} className="text-gray-400" />
                                                    <span className="text-gray-700">{lead.assigned_to_name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-300">未分配</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4">
                                            {lead.next_follow_up_at ? (
                                                <div className={`flex items-center gap-1 ${isUrgentFollowUp ? 'text-red-600 font-bold animate-pulse' : 'text-gray-600'}`}>
                                                    <Clock size={14} />
                                                    {formatDate(lead.next_follow_up_at)}
                                                </div>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4 text-gray-500">
                                            {formatDate(lead.created_at)}
                                        </td>

                                        <td className="px-6 py-4 text-right">
                                            {lead.data_source === 'lead' ? (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); }}
                                                    className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    查看详情
                                                </button>
                                            ) : (
                                                <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100">客户数据</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </SoftCard>

            {/* 详情抽屉 */}
            {selectedLead && (
                <LeadDetailDrawer
                    lead={selectedLead}
                    onClose={() => setSelectedLead(null)}
                    onUpdate={fetchLeads}
                />
            )}

            {/* 创建线索模态框 */}
            {showCreateModal && (
                <CreateLeadModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => {
                        setShowCreateModal(false);
                        fetchLeads();
                    }}
                />
            )}
        </SoftPageContainer>
    );
}
