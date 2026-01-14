/*
 * 创建试听课模态框
 */
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { X, Calendar, User, Phone, Clock, BookOpen } from 'lucide-react';

interface CreateTrialClassModalProps {
    onClose: () => void;
    onSuccess: () => void;
    initialData?: {
        student_name?: string;
        student_age?: number;
        parent_name?: string;
        parent_phone?: string;
        parent_wechat?: string;
    };
}

export default function CreateTrialClassModal({ onClose, onSuccess, leadId, initialData }: CreateTrialClassModalProps) {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        student_name: initialData?.student_name || '',
        student_age: initialData?.student_age?.toString() || '',
        student_grade: '',
        parent_name: initialData?.parent_name || '',
        parent_phone: initialData?.parent_phone || '',
        parent_wechat: initialData?.parent_wechat || '',
        scheduled_at: '',
        duration: '60',
        teacher_id: '',
        classroom: '',
        course_type: '',
        notes: '',
    });


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                ...formData,
                lead_id: leadId || null,
                student_age: formData.student_age ? parseInt(formData.student_age) : null,
                duration: parseInt(formData.duration),
                teacher_id: formData.teacher_id || null,
                scheduled_at: new Date(formData.scheduled_at).toISOString(),
            };

            const response = await fetch(`${API_BASE_URL}/base/trial-classes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                onSuccess();
            } else {
                alert('创建失败，请重试');
            }
        } catch (error) {
            console.error('Failed to create trial class:', error);
            alert('创建失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-md">
            <div
                className="bg-gradient-to-br from-white to-slate-50/30 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-100"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header - Soft UI */}
                <div className="sticky top-0 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-slate-100 px-6 py-5 flex justify-between items-center rounded-t-3xl">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                        <Calendar className="text-indigo-600" size={24} />
                        安排试听课
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-white/80 rounded-2xl transition-all">
                        <X size={24} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* 学员信息 */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <User size={16} className="text-indigo-600" />
                            学员信息
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    学员姓名 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.student_name}
                                    onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    placeholder="请输入学员姓名"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    年龄
                                </label>
                                <input
                                    type="number"
                                    value={formData.student_age}
                                    onChange={(e) => setFormData({ ...formData, student_age: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    placeholder="岁"
                                    min="3"
                                    max="18"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                年级
                            </label>
                            <input
                                type="text"
                                value={formData.student_grade}
                                onChange={(e) => setFormData({ ...formData, student_grade: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="例如：小学三年级"
                            />
                        </div>
                    </div>

                    {/* 家长信息 */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <Phone size={16} className="text-indigo-600" />
                            家长信息
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    家长姓名 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.parent_name}
                                    onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    placeholder="请输入家长姓名"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    联系电话 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    required
                                    value={formData.parent_phone}
                                    onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    placeholder="请输入手机号"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                微信号
                            </label>
                            <input
                                type="text"
                                value={formData.parent_wechat}
                                onChange={(e) => setFormData({ ...formData, parent_wechat: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="请输入微信号"
                            />
                        </div>
                    </div>

                    {/* 试听安排 */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <Clock size={16} className="text-indigo-600" />
                            试听安排
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    试听时间 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="datetime-local"
                                    required
                                    value={formData.scheduled_at}
                                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    时长（分钟）
                                </label>
                                <select
                                    value={formData.duration}
                                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                >
                                    <option value="30">30分钟</option>
                                    <option value="45">45分钟</option>
                                    <option value="60">60分钟</option>
                                    <option value="90">90分钟</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    课程类型
                                </label>
                                <input
                                    type="text"
                                    value={formData.course_type}
                                    onChange={(e) => setFormData({ ...formData, course_type: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    placeholder="例如：英语、数学"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    教室
                                </label>
                                <input
                                    type="text"
                                    value={formData.classroom}
                                    onChange={(e) => setFormData({ ...formData, classroom: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    placeholder="教室名称或编号"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 备注 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            备注
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                            placeholder="其他需要备注的信息..."
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 border-2 border-slate-200 text-slate-700 rounded-2xl hover:bg-slate-50 font-bold transition-all"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl hover:shadow-lg hover:shadow-indigo-300/50 shadow-md font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
                        >
                            {loading ? '创建中...' : '创建试听课'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
