'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { Plus, Wallet, Loader2, TrendingDown } from 'lucide-react';

// Soft UI Evolution colors
const SOFT_COLORS = {
    peach: '#FECACA',
    softPink: '#FFB6C1',
    lavender: '#A78BFA',
};

interface Expense {
    id: string;
    category: string;
    amount_cents: number;
    description: string;
    expense_date: string;
}

export default function BaseExpensesPage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);

    // 表单状态
    const [formData, setFormData] = useState({
        category: 'rent',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
    });

    useEffect(() => { if (token) fetchExpenses(); }, [token]);

    const fetchExpenses = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/finance/expenses`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setExpenses(await res.json());
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_BASE_URL}/finance/expenses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    ...formData,
                    amount: parseFloat(formData.amount)
                })
            });
            if (res.ok) {
                alert("支出记账成功！");
                setIsFormOpen(false);
                setFormData({ ...formData, amount: '', description: '' });
                fetchExpenses();
            }
        } catch (e) { alert("提交失败"); }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto min-h-screen"
            style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)' }}>
            {/* Header with Soft UI */}
            <div className="flex justify-between items-center mb-6 p-6 rounded-3xl"
                style={{
                    background: 'linear-gradient(135deg, rgba(255, 182, 193, 0.12), rgba(255, 182, 193, 0.05))',
                    boxShadow: '0 8px 32px rgba(255, 182, 193, 0.15)'
                }}>
                <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: '#334155' }}>
                    <Wallet size={28} style={{ color: SOFT_COLORS.softPink }} />
                    运营支出记账
                </h1>
                <button
                    onClick={() => setIsFormOpen(!isFormOpen)}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all hover:scale-105"
                    style={{
                        background: `linear-gradient(135deg, ${SOFT_COLORS.softPink}, ${SOFT_COLORS.peach})`,
                        color: '#FFF',
                        boxShadow: `0 4px 15px rgba(255, 182, 193, 0.3)`
                    }}
                >
                    <Plus size={16} /> 记一笔支出
                </button>
            </div>

            {/* 记账表单区域 - Soft UI */}
            {isFormOpen && (
                <div className="p-6 rounded-3xl mb-8 animate-in slide-in-from-top-4"
                    style={{
                        background: 'rgba(255, 255, 255, 0.9)',
                        border: `2px solid ${SOFT_COLORS.peach}40`,
                        boxShadow: '0 8px 32px rgba(255, 182, 193, 0.12)'
                    }}>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-2" style={{ color: '#64748B' }}>支出类型</label>
                            <select
                                className="w-full p-3 rounded-xl border-2 font-semibold outline-none transition-colors"
                                style={{ borderColor: '#E2E8F0', color: '#334155' }}
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                            >
                                <option value="rent">🏢 房租物业</option>
                                <option value="salary">👥 员工工资</option>
                                <option value="utility">💡 水电暖气杂费</option>
                                <option value="marketing">📢 市场推广</option>
                                <option value="other">📦 其他支出</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-2" style={{ color: '#64748B' }}>金额 (元)</label>
                            <input
                                type="number" step="0.01" required
                                className="w-full p-3 rounded-xl border-2 font-bold outline-none transition-colors"
                                style={{ borderColor: '#E2E8F0', color: '#334155' }}
                                value={formData.amount}
                                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-2" style={{ color: '#64748B' }}>日期</label>
                            <input
                                type="date" required
                                className="w-full p-3 rounded-xl border-2 font-bold outline-none transition-colors"
                                style={{ borderColor: '#E2E8F0', color: '#334155' }}
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-2" style={{ color: '#64748B' }}>备注说明</label>
                            <input
                                type="text"
                                className="w-full p-3 rounded-xl border-2outline-none transition-colors"
                                style={{ borderColor: '#E2E8F0', color: '#334155' }}
                                placeholder="如: 12月房租..."
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                        <div className="md:col-span-2 lg:col-span-4 flex justify-end mt-2">
                            <button type="submit"
                                className="px-8 py-3 rounded-xl font-bold transition-all hover:scale-105"
                                style={{
                                    background: `linear-gradient(135deg, ${SOFT_COLORS.softPink}, ${SOFT_COLORS.peach})`,
                                    color: '#FFF',
                                    boxShadow: '0 4px 15px rgba(255, 182, 193, 0.3)'
                                }}>
                                保存记录
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* 列表区域 - Soft UI */}
            <div className="rounded-3xl overflow-hidden"
                style={{
                    background: '#FFFFFF',
                    border: '1.5px solid #E2E8F0',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)'
                }}>
                {expenses.map(expense => (
                    <div key={expense.id}
                        className="p-5 border-b last:border-0 flex justify-between items-center transition-all hover:scale-105"
                        style={{ borderColor: '#F1F5F9', background: 'transparent' }}>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                                style={{
                                    background: `linear-gradient(135deg, ${SOFT_COLORS.peach}30, ${SOFT_COLORS.peach}10)`,
                                    color: SOFT_COLORS.softPink
                                }}>
                                <TrendingDown size={20} />
                            </div>
                            <div>
                                <div className="font-bold" style={{ color: '#334155' }}>
                                    {expense.description || '无备注'}
                                </div>
                                <div className="text-xs flex gap-2 mt-1" style={{ color: '#64748B' }}>
                                    <span>{expense.expense_date}</span>
                                    <span className="px-2 py-0.5 rounded-lg font-mono uppercase text-xs font-bold"
                                        style={{ background: '#F1F5F9', color: '#64748B' }}>
                                        {expense.category}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="text-xl font-black font-mono" style={{ color: '#334155' }}>
                            -¥{(expense.amount_cents / 100).toFixed(2)}
                        </div>
                    </div>
                ))}
                {expenses.length === 0 && !loading && (
                    <div className="p-16 text-center rounded-3xl"
                        style={{
                            background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.08), rgba(167, 139, 250, 0.03))',
                            color: '#64748B'
                        }}>
                        <p className="font-medium">本月暂无支出记录</p>
                    </div>
                )}
            </div>
        </div>
    );
}