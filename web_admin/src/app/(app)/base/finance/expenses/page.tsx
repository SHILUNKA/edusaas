'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { Plus, Wallet, Loader2, TrendingDown } from 'lucide-react';

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
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Wallet className="text-red-500"/> 运营支出记账
                </h1>
                <button 
                    onClick={() => setIsFormOpen(!isFormOpen)}
                    className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-gray-800"
                >
                    <Plus size={16}/> 记一笔支出
                </button>
            </div>

            {/* 记账表单区域 */}
            {isFormOpen && (
                <div className="bg-gray-50 border border-gray-200 p-6 rounded-2xl mb-8 animate-in slide-in-from-top-4">
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">支出类型</label>
                            <select 
                                className="w-full p-2 rounded-lg border font-bold"
                                value={formData.category}
                                onChange={e => setFormData({...formData, category: e.target.value})}
                            >
                                <option value="rent">🏢 房租物业</option>
                                <option value="salary">👥 员工工资</option>
                                <option value="utility">💡 水电暖气杂费</option>
                                <option value="marketing">📢 市场推广</option>
                                <option value="other">📦 其他支出</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">金额 (元)</label>
                            <input 
                                type="number" step="0.01" required
                                className="w-full p-2 rounded-lg border font-bold"
                                value={formData.amount}
                                onChange={e => setFormData({...formData, amount: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">日期</label>
                            <input 
                                type="date" required
                                className="w-full p-2 rounded-lg border font-bold"
                                value={formData.date}
                                onChange={e => setFormData({...formData, date: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">备注说明</label>
                            <input 
                                type="text" 
                                className="w-full p-2 rounded-lg border"
                                placeholder="如: 12月房租..."
                                value={formData.description}
                                onChange={e => setFormData({...formData, description: e.target.value})}
                            />
                        </div>
                        <div className="md:col-span-4 flex justify-end mt-2">
                             <button type="submit" className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700">保存记录</button>
                        </div>
                    </form>
                </div>
            )}

            {/* 列表区域 */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                {expenses.map(expense => (
                    <div key={expense.id} className="p-4 border-b last:border-0 flex justify-between items-center hover:bg-gray-50">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                                <TrendingDown size={18}/>
                            </div>
                            <div>
                                <div className="font-bold text-gray-900">{expense.description || '无备注'}</div>
                                <div className="text-xs text-gray-400 flex gap-2">
                                    <span>{expense.expense_date}</span>
                                    <span className="px-1.5 rounded bg-gray-100 text-gray-500 font-mono uppercase">{expense.category}</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-lg font-bold text-gray-900 font-mono">
                            -¥{(expense.amount_cents / 100).toFixed(2)}
                        </div>
                    </div>
                ))}
                {expenses.length === 0 && !loading && (
                    <div className="p-12 text-center text-gray-400">本月暂无支出记录</div>
                )}
            </div>
        </div>
    );
}