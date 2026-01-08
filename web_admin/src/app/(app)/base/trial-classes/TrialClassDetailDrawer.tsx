/*
 * 试听课详情抽屉
 */
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
    X, User, Phone, Calendar, Clock, BookOpen, MapPin,
    Star, MessageSquare, TrendingUp, Edit, CheckCircle
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/config';

interface TrialClassDetailDrawerProps {
    trialClassId: number;
    onClose: () => void;
    onUpdate: () => void;
}

interface TrialClass {
    id: string;
    student_name: string;
    student_age?: number;
    student_grade?: string;
    parent_name: string;
    parent_phone: string;
    parent_wechat?: string;
    scheduled_at: string;
    duration: number;
    teacher_name?: string;
    classroom?: string;
    course_type?: string;
    status: string;
    feedback?: string;
    student_performance?: number;
    parent_satisfaction?: number;
    conversion_intent?: string;
    notes?: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: '待确认', color: 'text-yellow-700', bg: 'bg-yellow-50' },
    confirmed: { label: '已安排', color: 'text-blue-700', bg: 'bg-blue-50' },
    completed: { label: '已完成', color: 'text-green-700', bg: 'bg-green-50' },
    cancelled: { label: '已取消', color: 'text-gray-700', bg: 'bg-gray-50' },
};

const INTENT_MAP: Record<string, { label: string; color: string }> = {
    high: { label: '高意向', color: 'text-red-600' },
    medium: { label: '中等意向', color: 'text-orange-600' },
    low: { label: '低意向', color: 'text-yellow-600' },
    none: { label: '无意向', color: 'text-gray-600' },
};

export default function TrialClassDetailDrawer({ trialClassId, onClose, onUpdate }: TrialClassDetailDrawerProps) {
    const { data: session } = useSession();
    const [trialClass, setTrialClass] = useState<TrialClass | null>(null);
    const [loading, setLoading] = useState(true);
    const [showFeedbackForm, setShowFeedbackForm] = useState(false);
    const [feedbackForm, setFeedbackForm] = useState({
        feedback: '',
        student_performance: 3,
        parent_satisfaction: 3,
        conversion_intent: 'medium',
    });

    useEffect(() => {
        fetchTrialClass();
    }, [trialClassId]);

    const fetchTrialClass = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/base/trial-classes/${trialClassId}`, {
                headers: {
                    'Authorization': `Bearer ${session?.accessToken}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setTrialClass(data);
            }
        } catch (error) {
            console.error('Failed to fetch trial class:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitFeedback = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/base/trial-classes/${trialClassId}/feedback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.accessToken}`,
                },
                body: JSON.stringify(feedbackForm),
            });

            if (response.ok) {
                setShowFeedbackForm(false);
                fetchTrialClass();
                onUpdate();
            } else {
                alert('提交反馈失败');
            }
        } catch (error) {
            console.error('Failed to submit feedback:', error);
            alert('提交反馈失败');
        }
    };

    const handleConfirm = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/base/trial-classes/${trialClassId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.accessToken}`,
                },
                body: JSON.stringify({ status: 'confirmed' }),
            });

            if (response.ok) {
                fetchTrialClass();
                onUpdate();
            }
        } catch (error) {
            console.error('Failed to confirm:', error);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (loading) {
        return (
            <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-white shadow-2xl z-50 flex items-center justify-center">
                <div className="text-gray-500">加载中...</div>
            </div>
        );
    }

    if (!trialClass) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/30 z-50 flex justify-end" onClick={onClose}>
            <div
                className="w-full md:w-[500px] bg-white shadow-2xl overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-indigo-600  to-purple-600 text-white px-6 py-4 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold">试听课详情</h2>
                        <p className="text-sm text-indigo-100 mt-1">{trialClass.student_name}</p>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between">
                        <span className={`px-4 py-2 rounded-full font-bold text-sm ${STATUS_MAP[trialClass.status].bg} ${STATUS_MAP[trialClass.status].color}`}>
                            {STATUS_MAP[trialClass.status].label}
                        </span>

                        {trialClass.status === 'pending' && (
                            <button
                                onClick={handleConfirm}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                            >
                                <CheckCircle size={16} />
                                确认安排
                            </button>
                        )}
                    </div>

                    {/* 学员信息 */}
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <User size={18} className="text-indigo-600" />
                            学员信息
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">姓名：</span>
                                <span className="font-medium text-gray-900">{trialClass.student_name}</span>
                            </div>
                            {trialClass.student_age && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">年龄：</span>
                                    <span className="font-medium text-gray-900">{trialClass.student_age} 岁</span>
                                </div>
                            )}
                            {trialClass.student_grade && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">年级：</span>
                                    <span className="font-medium text-gray-900">{trialClass.student_grade}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 家长信息 */}
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <Phone size={18} className="text-indigo-600" />
                            家长信息
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">姓名：</span>
                                <span className="font-medium text-gray-900">{trialClass.parent_name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">电话：</span>
                                <a href={`tel:${trialClass.parent_phone}`} className="font-medium text-indigo-600 hover:text-indigo-700">
                                    {trialClass.parent_phone}
                                </a>
                            </div>
                            {trialClass.parent_wechat && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">微信：</span>
                                    <span className="font-medium text-gray-900">{trialClass.parent_wechat}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 试听安排 */}
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <Calendar size={18} className="text-indigo-600" />
                            试听安排
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">时间：</span>
                                <span className="font-medium text-gray-900">{formatDate(trialClass.scheduled_at)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">时长：</span>
                                <span className="font-medium text-gray-900">{trialClass.duration} 分钟</span>
                            </div>
                            {trialClass.teacher_name && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">老师：</span>
                                    <span className="font-medium text-gray-900">{trialClass.teacher_name}</span>
                                </div>
                            )}
                            {trialClass.classroom && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">教室：</span>
                                    <span className="font-medium text-gray-900">{trialClass.classroom}</span>
                                </div>
                            )}
                            {trialClass.course_type && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">课程：</span>
                                    <span className="font-medium text-gray-900">{trialClass.course_type}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 备注 */}
                    {trialClass.notes && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <h3 className="font-bold text-amber-900 flex items-center gap-2 mb-2">
                                <MessageSquare size={16} />
                                备注
                            </h3>
                            <p className="text-sm text-amber-800">{trialClass.notes}</p>
                        </div>
                    )}

                    {/* 课后反馈 */}
                    {trialClass.status === 'completed' && trialClass.feedback ? (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                            <h3 className="font-bold text-green-900 flex items-center gap-2">
                                <Star size={18} className="text-green-600" />
                                课后反馈
                            </h3>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">学员表现：</span>
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <Star
                                                key={star}
                                                size={16}
                                                className={star <= (trialClass.student_performance || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">家长满意度：</span>
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <Star
                                                key={star}
                                                size={16}
                                                className={star <= (trialClass.parent_satisfaction || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {trialClass.conversion_intent && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">转化意向：</span>
                                        <span className={`text-sm font-bold ${INTENT_MAP[trialClass.conversion_intent].color}`}>
                                            {INTENT_MAP[trialClass.conversion_intent].label}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="pt-2 border-t border-green-200">
                                <p className="text-sm text-green-900">{trialClass.feedback}</p>
                            </div>
                        </div>
                    ) : trialClass.status === 'confirmed' && !showFeedbackForm ? (
                        <button
                            onClick={() => setShowFeedbackForm(true)}
                            className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <Edit size={18} />
                            添加课后反馈
                        </button>
                    ) : null}

                    {/* 反馈表单 */}
                    {showFeedbackForm && (
                        <div className="bg-white border-2 border-indigo-200 rounded-xl p-4 space-y-4">
                            <h3 className="font-bold text-gray-900">添加课后反馈</h3>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">学员表现</label>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setFeedbackForm({ ...feedbackForm, student_performance: star })}
                                        >
                                            <Star
                                                size={24}
                                                className={star <= feedbackForm.student_performance ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">家长满意度</label>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setFeedbackForm({ ...feedbackForm, parent_satisfaction: star })}
                                        >
                                            <Star
                                                size={24}
                                                className={star <= feedbackForm.parent_satisfaction ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">转化意向</label>
                                <select
                                    value={feedbackForm.conversion_intent}
                                    onChange={(e) => setFeedbackForm({ ...feedbackForm, conversion_intent: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                >
                                    <option value="high">高意向</option>
                                    <option value="medium">中等意向</option>
                                    <option value="low">低意向</option>
                                    <option value="none">无意向</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">详细反馈</label>
                                <textarea
                                    value={feedbackForm.feedback}
                                    onChange={(e) => setFeedbackForm({ ...feedbackForm, feedback: e.target.value })}
                                    rows={4}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                                    placeholder="请输入课后反馈..."
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowFeedbackForm(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                                >
                                    取消
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmitFeedback}
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                                >
                                    提交反馈
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
