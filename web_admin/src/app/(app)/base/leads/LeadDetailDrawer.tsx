/*
 * 线索详情抽屉 - Lead Detail Drawer
 * 显示线索完整信息和跟进记录时间线
 */
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import {
    X, Phone, User, Calendar, Star,
    MessageSquare, Clock, CheckCircle, AlertCircle
} from 'lucide-react';
import CreateTrialClassModal from '../trial-classes/CreateTrialClassModal';

interface LeadDetail {
    id: string;
    contact_name: string;
    phone_number: string;
    wechat_id: string | null;
    child_name: string | null;
    child_age: number | null;
    child_grade: string | null;
    source: string | null;
    status: string;
    quality_score: number | null;
    assigned_to_name: string | null;
    last_contact_at: string | null;
    next_follow_up_at: string | null;
    notes: string | null;
    tags: string[] | null;
    created_at: string;
    follow_up_records: FollowUpRecord[];
}

interface FollowUpRecord {
    id: string;
    follow_up_type: string;
    content: string;
    outcome: string | null;
    created_by_name: string;
    created_at: string;
}

interface Props {
    lead: { id: string };
    onClose: () => void;
    onUpdate: () => void;
}

const FOLLOW_UP_TYPE_MAP: Record<string, string> = {
    call: '📞 电话',
    wechat: '💬 微信',
    visit: '🏠 到店',
    email: '📧 邮件',
};

const OUTCOME_MAP: Record<string, { label: string; icon: string; color: string }> = {
    positive: { label: '积极', icon: '👍', color: 'text-green-600' },
    neutral: { label: '中立', icon: '👌', color: 'text-gray-600' },
    negative: { label: '消极', icon: '👎', color: 'text-red-600' },
    no_answer: { label: '未接通', icon: '📵', color: 'text-gray-400' },
};

export default function LeadDetailDrawer({ lead, onClose, onUpdate }: Props) {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const API = API_BASE_URL;

    const [detail, setDetail] = useState<LeadDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddFollowUp, setShowAddFollowUp] = useState(false);
    const [showTrialModal, setShowTrialModal] = useState(false);

    // 跟进表单
    const [followUpForm, setFollowUpForm] = useState({
        follow_up_type: 'call',
        content: '',
        outcome: '',
        next_follow_up_at: '',
    });

    // 加载详情
    const fetchDetail = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${API}/base/leads/${lead.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setDetail(data);
            }
        } catch (e) {
            console.error('Failed to fetch lead detail:', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchDetail(); }, [lead.id]);

    // 添加跟进记录
    const handleAddFollowUp = async () => {
        if (!followUpForm.content.trim()) {
            alert('请输入跟进内容');
            return;
        }

        try {
            const res = await fetch(`${API}/base/leads/${lead.id}/follow-up`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(followUpForm),
            });

            if (res.ok) {
                alert('跟进记录添加成功');
                setShowAddFollowUp(false);
                setFollowUpForm({ follow_up_type: 'call', content: '', outcome: '', next_follow_up_at: '' });
                fetchDetail();
                onUpdate();
            } else {
                alert('添加失败');
            }
        } catch (e) {
            console.error('Failed to add follow-up:', e);
            alert('添加失败');
        }
    };

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                <div className="bg-white rounded-lg p-12">
                    <div className="text-center text-gray-500">加载中...</div>
                </div>
            </div>
        );
    }

    if (!detail) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={onClose}>
            <div
                className="bg-white w-[600px] h-full overflow-y-auto shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold text-gray-900">客户详情</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowTrialModal(true)}
                            className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 flex items-center gap-1"
                        >
                            <Calendar size={16} /> 安排试听
                        </button>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* 基本信息 */}
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-900">{detail.contact_name}</h3>
                                <div className="flex items-center gap-2 mt-2 text-gray-600">
                                    <Phone size={16} /> {detail.phone_number}
                                </div>
                                {detail.wechat_id && (
                                    <div className="text-sm text-gray-500 mt-1">微信: {detail.wechat_id}</div>
                                )}
                            </div>
                            {detail.quality_score && (
                                <div className="flex gap-0.5">
                                    {[...Array(5)].map((_, i) => (
                                        <Star
                                            key={i}
                                            size={20}
                                            className={i < detail.quality_score! ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 孩子信息 */}
                        {detail.child_name && (
                            <div className="bg-white/70 rounded-lg p-4 mt-4">
                                <div className="text-sm text-gray-500 mb-1">孩子信息</div>
                                <div className="font-medium text-gray-900">
                                    {detail.child_name}
                                    {detail.child_age && ` · ${detail.child_age}岁`}
                                    {detail.child_grade && ` · ${detail.child_grade}`}
                                </div>
                            </div>
                        )}

                        {/* 其他信息 */}
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div>
                                <div className="text-xs text-gray-500">来源</div>
                                <div className="font-medium text-gray-900">{detail.source || '-'}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">负责人</div>
                                <div className="font-medium text-gray-900">{detail.assigned_to_name || '未分配'}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">下次跟进</div>
                                <div className="font-medium text-gray-900">
                                    {detail.next_follow_up_at ? new Date(detail.next_follow_up_at).toLocaleString('zh-CN') : '-'}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">创建时间</div>
                                <div className="font-medium text-gray-900">
                                    {new Date(detail.created_at).toLocaleDateString('zh-CN')}
                                </div>
                            </div>
                        </div>

                        {/* 备注 */}
                        {detail.notes && (
                            <div className="mt-4 bg-white/70 rounded-lg p-4">
                                <div className="text-xs text-gray-500 mb-1">备注</div>
                                <div className="text-sm text-gray-700">{detail.notes}</div>
                            </div>
                        )}
                    </div>

                    {/* 跟进记录 */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-900">跟进记录</h3>
                            <button
                                onClick={() => setShowAddFollowUp(!showAddFollowUp)}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                            >
                                + 添加跟进
                            </button>
                        </div>

                        {/* 添加跟进表单 */}
                        {showAddFollowUp && (
                            <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">跟进方式</label>
                                    <select
                                        value={followUpForm.follow_up_type}
                                        onChange={(e) => setFollowUpForm({ ...followUpForm, follow_up_type: e.target.value })}
                                        className="w-full p-2 border rounded-lg"
                                    >
                                        <option value="call">电话</option>
                                        <option value="wechat">微信</option>
                                        <option value="visit">到店</option>
                                        <option value="email">邮件</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">跟进内容</label>
                                    <textarea
                                        value={followUpForm.content}
                                        onChange={(e) => setFollowUpForm({ ...followUpForm, content: e.target.value })}
                                        className="w-full p-2 border rounded-lg"
                                        rows={3}
                                        placeholder="请输入跟进内容..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">跟进结果</label>
                                    <select
                                        value={followUpForm.outcome}
                                        onChange={(e) => setFollowUpForm({ ...followUpForm, outcome: e.target.value })}
                                        className="w-full p-2 border rounded-lg"
                                    >
                                        <option value="">请选择</option>
                                        <option value="positive">积极</option>
                                        <option value="neutral">中立</option>
                                        <option value="negative">消极</option>
                                        <option value="no_answer">未接通</option>
                                    </select>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={handleAddFollowUp}
                                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
                                    >
                                        提交
                                    </button>
                                    <button
                                        onClick={() => setShowAddFollowUp(false)}
                                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
                                    >
                                        取消
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 时间线 */}
                        <div className="space-y-4">
                            {detail.follow_up_records?.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">暂无跟进记录</div>
                            ) : (
                                detail.follow_up_records?.map((record, index) => {
                                    const outcomeInfo = record.outcome ? OUTCOME_MAP[record.outcome] : null;

                                    return (
                                        <div key={record.id} className="relative pl-8 pb-4">
                                            {/* 时间线 */}
                                            {index !== (detail.follow_up_records?.length || 0) - 1 && (
                                                <div className="absolute left-2 top-8 bottom-0 w-0.5 bg-gray-200"></div>
                                            )}

                                            {/* 节点 */}
                                            <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-purple-500 border-2 border-white shadow"></div>

                                            {/* 内容 */}
                                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium text-purple-600">
                                                            {FOLLOW_UP_TYPE_MAP[record.follow_up_type] || record.follow_up_type}
                                                        </span>
                                                        {outcomeInfo && (
                                                            <span className={`text-xs ${outcomeInfo.color}`}>
                                                                {outcomeInfo.icon} {outcomeInfo.label}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-400">
                                                        {new Date(record.created_at).toLocaleString('zh-CN')}
                                                    </div>
                                                </div>

                                                <div className="text-sm text-gray-700 mb-2">{record.content}</div>

                                                <div className="text-xs text-gray-500">
                                                    记录人: {record.created_by_name}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* 试听课弹窗 */}
                {showTrialModal && (
                    <CreateTrialClassModal
                        leadId={lead.id}
                        initialData={{
                            student_name: detail.child_name || '',
                            student_age: detail.child_age || undefined,
                            parent_name: detail.contact_name,
                            parent_phone: detail.phone_number,
                            parent_wechat: detail.wechat_id || '',
                        }}
                        onClose={() => setShowTrialModal(false)}
                        onSuccess={() => {
                            setShowTrialModal(false);
                            onUpdate(); // 可能会有状态变更
                            alert('试听课安排成功！');
                        }}
                    />
                )}
            </div>
        </div>
    );
}
