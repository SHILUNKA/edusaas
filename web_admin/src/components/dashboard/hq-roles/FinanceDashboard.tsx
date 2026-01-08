'use client';
import { DollarSign, PieChart, FileText } from 'lucide-react';

export default function FinanceDashboard({ stats }: any) {
    const cashIn = stats?.basic?.month_revenue || 0;
    // ✅ Use real prepaid pool from HQ dashboard stats (if available)
    // Note: This requires backend to add prepaid_pool to dashboard stats API
    const totalPool = stats?.prepaid_pool || 0; // Will be 0 until backend is updated

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">集团财务中心</h2>
                <div className="text-sm font-mono bg-green-50 text-green-700 px-3 py-1 rounded-full">
                    💰 财务视图
                </div>
            </div>

            {/* 资金池 */}
            <div className="bg-emerald-600 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <div className="text-emerald-100 font-bold mb-2 flex items-center gap-2">
                        <DollarSign size={20} /> 集团可用资金池
                    </div>
                    <div className="text-5xl font-bold tracking-tight">¥ {(totalPool / 100).toLocaleString()}</div>
                    <div className="mt-6 flex gap-12 text-sm font-medium opacity-90">
                        <div>今日进账: +¥{(stats?.basic?.today_revenue / 100).toLocaleString() || 0}</div>
                        <div>本月进账: +¥{(cashIn / 100).toLocaleString()}</div>
                        <div>待结算: ¥32,000</div>
                    </div>
                </div>
                <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 支出构成 */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><PieChart size={18} /> 本月支出构成</h3>
                    </div>
                    <div className="space-y-4">
                        {stats?.expense_composition && stats.expense_composition.length > 0 ? (
                            stats.expense_composition.map((item: any) => (
                                <ExpenseBar
                                    key={item.category}
                                    label={`${item.category_name} (${item.percentage}%)`}
                                    value={item.percentage}
                                    color={item.color || 'bg-blue-500'}
                                />
                            ))
                        ) : (
                            <div className="text-center text-gray-400 text-sm py-8">
                                暂无支出数据<br />
                                <span className="text-xs">待后端提供 expense_composition 字段</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 待办审批 */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><FileText size={18} /> 待审批单据</h3>
                        {stats?.pending_payments?.length > 0 && (
                            <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-xs font-bold">
                                {stats.pending_payments.length} 笔
                            </span>
                        )}
                    </div>
                    <div className="space-y-3">
                        {stats?.pending_payments?.length > 0 ? (
                            stats.pending_payments.slice(0, 3).map((item: any) => (
                                <ApprovalItem
                                    key={item.id}
                                    title={`${item.base_name} - ${item.description || '收款凭证'}`}
                                    amount={`¥${(item.amount_cents / 100).toLocaleString()}`}
                                    user={item.submitter_name || '未知'}
                                    date={new Date(item.created_at).toLocaleDateString()}
                                />
                            ))
                        ) : (
                            <div className="text-center text-gray-400 text-sm py-4">暂无待审批单据</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ExpenseBar({ label, value, color }: any) {
    return (
        <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1 font-bold">{label}</div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${value}%` }}></div>
            </div>
        </div>
    );
}

function ApprovalItem({ title, amount, user, date }: any) {
    return (
        <div className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg transition-colors border border-gray-100 cursor-pointer group">
            <div>
                <div className="font-bold text-sm text-gray-800 group-hover:text-indigo-600 transition-colors">{title}</div>
                <div className="text-xs text-gray-400 mt-0.5">{user} • {date}</div>
            </div>
            <div className="font-mono font-bold text-gray-900">{amount}</div>
        </div>
    );
}