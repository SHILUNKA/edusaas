'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { Order } from './SalesOrderPage'; // 引用 Order 接口
import { X, Loader2, Calendar, Users, DollarSign, Save } from 'lucide-react';

interface Props {
    order: Order | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function EditOrderDrawer({ order, isOpen, onClose, onSuccess }: Props) {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        event_date: '',
        expected_attendees: 0,
        total_amount: 0,
    });

    // 初始化回显数据
    useEffect(() => {
        if (order && isOpen) {
            setFormData({
                event_date: order.event_date ? order.event_date.split('T')[0] : '',
                expected_attendees: order.expected_attendees,
                total_amount: order.total_amount_cents / 100,
            });
        }
    }, [order, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!order) return;
        setSubmitting(true);

        try {
            const res = await fetch(`${API_BASE_URL}/finance/orders/${order.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    event_date: formData.event_date,
                    expected_attendees: Number(formData.expected_attendees),
                    total_amount: Number(formData.total_amount)
                })
            });

            if (res.ok) {
                onSuccess();
                onClose();
            } else {
                alert("修改失败，订单可能已锁定（已付款或取消）");
            }
        } catch (err) { console.error(err); } 
        finally { setSubmitting(false); }
    };

    if (!isOpen || !order) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white h-full shadow-2xl p-6 flex flex-col animate-in slide-in-from-right duration-300">
                
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">编辑订单</h2>
                        <p className="text-xs text-gray-500 font-mono mt-1">{order.order_no}</p>
                    </div>
                    <button onClick={onClose}><X size={20} className="text-gray-400"/></button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 space-y-6">
                    <div className="bg-yellow-50 text-yellow-700 p-3 rounded-lg text-xs mb-4">
                        ⚠️ 仅未付款的订单可修改。如需修改客户信息请取消后重开。
                    </div>

                    {/* 日期 & 人数 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">活动日期</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-3 text-gray-400" size={16}/>
                                <input type="date" required className="w-full pl-9 p-3 bg-gray-50 border border-gray-200 rounded-xl"
                                    value={formData.event_date}
                                    onChange={e => setFormData({...formData, event_date: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">预计人数</label>
                            <div className="relative">
                                <Users className="absolute left-3 top-3 text-gray-400" size={16}/>
                                <input type="number" className="w-full pl-9 p-3 bg-gray-50 border border-gray-200 rounded-xl"
                                    value={formData.expected_attendees}
                                    onChange={e => setFormData({...formData, expected_attendees: Number(e.target.value)})}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 金额 */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">订单总金额</label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-3 text-gray-400" size={16}/>
                            <input type="number" step="0.01" required className="w-full pl-9 p-3 bg-gray-50 border border-gray-200 rounded-xl text-lg font-bold"
                                value={formData.total_amount}
                                onChange={e => setFormData({...formData, total_amount: Number(e.target.value)})}
                            />
                        </div>
                    </div>
                </form>

                <div className="pt-4 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl">取消</button>
                    <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl flex justify-center items-center gap-2 hover:bg-indigo-700">
                        {submitting ? <Loader2 className="animate-spin" size={18}/> : <><Save size={18}/> 保存修改</>}
                    </button>
                </div>
            </div>
        </div>
    );
}