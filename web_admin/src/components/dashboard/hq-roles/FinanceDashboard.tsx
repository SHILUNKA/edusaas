'use client';
import { DollarSign, PieChart, FileText } from 'lucide-react';

export default function FinanceDashboard() {
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
                        <DollarSign size={20}/> 集团可用资金池
                    </div>
                    <div className="text-5xl font-bold tracking-tight">¥ 850,000.00</div>
                    <div className="mt-6 flex gap-12 text-sm font-medium opacity-90">
                        <div>今日进账: +¥12,800</div>
                        <div>今日支出: -¥4,500</div>
                        <div>待结算: ¥32,000</div>
                    </div>
                </div>
                <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 支出构成 */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><PieChart size={18}/> 本月支出构成</h3>
                    </div>
                    <div className="space-y-4">
                        <ExpenseBar label="人员薪资 (65%)" value={65} color="bg-blue-500" />
                        <ExpenseBar label="房租水电 (20%)" value={20} color="bg-indigo-500" />
                        <ExpenseBar label="采购物料 (10%)" value={10} color="bg-orange-500" />
                        <ExpenseBar label="营销推广 (5%)" value={5} color="bg-green-500" />
                    </div>
                </div>

                {/* 待办审批 */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><FileText size={18}/> 待审批单据</h3>
                        <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-xs font-bold">3 笔</span>
                    </div>
                    <div className="space-y-3">
                        <ApprovalItem title="北京校区 - 季度教具采购" amount="¥12,000" user="王校长" date="10:23" />
                        <ApprovalItem title="上海校区 - 装修尾款支付" amount="¥5,800" user="李行政" date="昨天" />
                        <ApprovalItem title="深圳校区 - 团建费用报销" amount="¥2,200" user="张教务" date="前天" />
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