/*
 * 创建线索模态框 - Create Lead Modal
 */
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { X, Star } from 'lucide-react';

interface Props {
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateLeadModal({ onClose, onSuccess }: Props) {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const API = API_BASE_URL;

    const [form, setForm] = useState({
        contact_name: '',
        phone_number: '',
        wechat_id: '',
        child_name: '',
        child_age: '',
        child_grade: '',
        source: '',
        quality_score: 3,
        notes: '',
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.contact_name || !form.phone_number) {
            alert('请填写联系人姓名和电话');
            return;
        }

        setIsSubmitting(true);

        try {
            const payload = {
                ...form,
                child_age: form.child_age ? parseInt(form.child_age) : null,
            };

            const res = await fetch(`${API}/base/leads`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                alert('线索创建成功');
                onSuccess();
            } else {
                const error = await res.json();
                alert(`创建失败: ${error.message || '未知错误'}`);
            }
        } catch (e) {
            console.error('Failed to create lead:', e);
            alert('创建失败');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900">新增客户</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* 联系人信息 */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-4">联系人信息</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    联系人姓名 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.contact_name}
                                    onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                                    className="w-full p-2 border rounded-lg"
                                    placeholder="请输入姓名"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    联系电话 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    value={form.phone_number}
                                    onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                                    className="w-full p-2 border rounded-lg"
                                    placeholder="请输入手机号"
                                    required
                                />
                            </div>

                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">微信号</label>
                                <input
                                    type="text"
                                    value={form.wechat_id}
                                    onChange={(e) => setForm({ ...form, wechat_id: e.target.value })}
                                    className="w-full p-2 border rounded-lg"
                                    placeholder="请输入微信号（选填）"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 孩子信息 */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-4">孩子信息</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">孩子姓名</label>
                                <input
                                    type="text"
                                    value={form.child_name}
                                    onChange={(e) => setForm({ ...form, child_name: e.target.value })}
                                    className="w-full p-2 border rounded-lg"
                                    placeholder="请输入"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">年龄</label>
                                <input
                                    type="number"
                                    value={form.child_age}
                                    onChange={(e) => setForm({ ...form, child_age: e.target.value })}
                                    className="w-full p-2 border rounded-lg"
                                    placeholder="岁"
                                    min="0"
                                    max="18"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">年级</label>
                                <select
                                    value={form.child_grade}
                                    onChange={(e) => setForm({ ...form, child_grade: e.target.value })}
                                    className="w-full p-2 border rounded-lg"
                                >
                                    <option value="">请选择</option>
                                    <option value="学龄前">学龄前</option>
                                    <option value="小学一年级">小学一年级</option>
                                    <option value="小学二年级">小学二年级</option>
                                    <option value="小学三年级">小学三年级</option>
                                    <option value="小学四年级">小学四年级</option>
                                    <option value="小学五年级">小学五年级</option>
                                    <option value="小学六年级">小学六年级</option>
                                    <option value="初中">初中</option>
                                    <option value="高中">高中</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 线索信息 */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-4">线索信息</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">线索来源</label>
                                <select
                                    value={form.source}
                                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                                    className="w-full p-2 border rounded-lg"
                                >
                                    <option value="">请选择</option>
                                    <option value="线上广告">线上广告</option>
                                    <option value="朋友推荐">朋友推荐</option>
                                    <option value="到店咨询">到店咨询</option>
                                    <option value="活动">活动</option>
                                    <option value="其他">其他</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">质量评分</label>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map((score) => (
                                        <button
                                            key={score}
                                            type="button"
                                            onClick={() => setForm({ ...form, quality_score: score })}
                                            className="transition-transform hover:scale-110"
                                        >
                                            <Star
                                                size={32}
                                                className={score <= form.quality_score
                                                    ? 'fill-amber-400 text-amber-400'
                                                    : 'text-gray-300'
                                                }
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                                <textarea
                                    value={form.notes}
                                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                    className="w-full p-2 border rounded-lg"
                                    rows={4}
                                    placeholder="请输入备注信息（选填）"
                                    maxLength={500}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? '创建中...' : '创建客户'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300"
                        >
                            取消
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
