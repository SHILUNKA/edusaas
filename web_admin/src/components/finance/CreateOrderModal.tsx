/*
 * 新建订单弹窗
 * 路径: web_admin/components/finance/CreateOrderModal.tsx
 */
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { X, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/lib/config';

interface Props {
    onClose: () => void;
    onSuccess: () => void;
}

export function CreateOrderModal({ onClose, onSuccess }: Props) {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const [loading, setLoading] = useState(false);

    // 表单状态
    const [formData, setFormData] = useState({
        type_: 'b2c', // 默认个人零售
        contact_name: '',
        total_amount: '',
        expected_attendees: 1,
        event_date: new Date().toISOString().split('T')[0], // 默认为今天
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE_URL}/finance/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...formData,
                    // 转换数据格式
                    total_amount: parseFloat(formData.total_amount),
                    expected_attendees: parseInt(formData.expected_attendees.toString()),
                    // 暂时不传 customer_id，简化为直接录入联系人
                    customer_id: null 
                })
            });

            if (res.ok) {
                alert("订单创建成功！");
                onSuccess();
                onClose();
            } else {
                alert("创建失败，请检查输入");
            }
        } catch (error) {
            console.error(error);
            alert("网络错误");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-lg font-bold text-gray-900">新建销售订单</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    
                    {/* 订单类型 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">业务类型</label>
                        <select 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            value={formData.type_}
                            onChange={e => setFormData({...formData, type_: e.target.value})}
                        >
                            <option value="b2c">个人零售 (B2C) - 课包/散客</option>
                            <option value="b2b">校企合作 (B2B) - 进校服务</option>
                            <option value="b2g">政府采购 (B2G) - 研学/党建</option>
                        </select>
                    </div>

                    {/* 客户姓名 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">客户/联系人姓名</label>
                        <input 
                            type="text" 
                            required
                            placeholder="例如: 张老师 / 李明家长"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            value={formData.contact_name}
                            onChange={e => setFormData({...formData, contact_name: e.target.value})}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* 预计人数 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">预计人数</label>
                            <input 
                                type="number" 
                                min="1"
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                value={formData.expected_attendees}
                                onChange={e => setFormData({...formData, expected_attendees: parseInt(e.target.value)})}
                            />
                        </div>
                        {/* 业务日期 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">业务日期</label>
                            <input 
                                type="date" 
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                value={formData.event_date}
                                onChange={e => setFormData({...formData, event_date: e.target.value})}
                            />
                        </div>
                    </div>

                    {/* 订单总额 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">订单总金额 (元)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">¥</span>
                            <input 
                                type="number" 
                                step="0.01"
                                required
                                placeholder="0.00"
                                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono text-lg font-bold text-indigo-600"
                                value={formData.total_amount}
                                onChange={e => setFormData({...formData, total_amount: e.target.value})}
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            * 此金额为合同/应收总额，实收金额请在创建后通过“上传凭证”录入。
                        </p>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            取消
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                        >
                            {loading && <Loader2 size={16} className="animate-spin" />}
                            {loading ? '创建中...' : '确认创建'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}