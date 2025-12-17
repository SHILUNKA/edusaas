'use client';
import { DollarSign, FileText, ShoppingCart, ArrowUpRight } from 'lucide-react';

export default function FinanceDashboard() {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">财务中心</h2>
                <div className="text-sm font-mono bg-green-50 text-green-700 px-3 py-1 rounded-full">
                    💰 财务视图
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 核心卡片：今日实收 */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg md:col-span-2">
                    <div className="flex items-center gap-2 opacity-90 mb-2 font-bold">
                        <DollarSign size={20}/> 今日实收 (Cash + Online)
                    </div>
                    <div className="text-4xl font-bold tracking-tight">¥ 24,580.00</div>
                    <div className="mt-4 pt-4 border-t border-white/20 flex gap-8 text-sm font-medium opacity-90">
                        <div>学费: ¥22,000</div>
                        <div>教具: ¥2,580</div>
                    </div>
                </div>

                {/* 待办区 */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-center items-center text-center">
                    <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-3">
                        <ShoppingCart size={24}/>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">3 笔</div>
                    <div className="text-sm text-gray-500">待审批采购申请</div>
                    <button className="mt-4 text-sm text-indigo-600 font-bold hover:underline">去审批 &rarr;</button>
                </div>
            </div>

            {/* 近期流水 */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-5 border-b border-gray-100 bg-gray-50 font-bold text-gray-800">
                    <FileText className="inline mr-2" size={18}/> 实时入账明细
                </div>
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50/50 text-gray-500">
                        <tr>
                            <th className="p-4">时间</th>
                            <th className="p-4">摘要</th>
                            <th className="p-4">经办人</th>
                            <th className="p-4 text-right">金额</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        <Tr time="10:23" desc="张三 - 学费续费 (半年卡)" user="王财务" amount="+ 3,800" />
                        <Tr time="11:05" desc="李四 - 购买教材包" user="前台A" amount="+ 580" />
                        <Tr time="14:12" desc="王五 - 试听课报名费" user="李销售" amount="+ 99" />
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function Tr({ time, desc, user, amount }: any) {
    return (
        <tr className="hover:bg-gray-50">
            <td className="p-4 text-gray-500 font-mono">{time}</td>
            <td className="p-4 font-bold text-gray-900">{desc}</td>
            <td className="p-4 text-gray-500">{user}</td>
            <td className="p-4 text-right font-bold text-emerald-600">{amount}</td>
        </tr>
    );
}