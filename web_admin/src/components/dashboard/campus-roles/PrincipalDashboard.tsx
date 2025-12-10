'use client';
import { TrendingUp, Users, AlertTriangle, Wallet } from 'lucide-react';

export default function PrincipalDashboard({ baseName }: { baseName?: string }) {
    // 模拟数据 (未来替换为 API: /api/v1/base/dashboard/stats)
    const stats = {
        monthlyRevenue: 128000,
        studentCount: 856,
        activeRate: 94,
        alerts: 2
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">{baseName || '校区'}运营驾驶舱</h2>
                    <p className="text-gray-500">全校经营数据概览。</p>
                </div>
                <div className="text-sm font-mono bg-purple-50 text-purple-700 px-3 py-1 rounded-full">
                    👑 校长视图
                </div>
            </div>

            {/* 核心 KPI */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard icon={Wallet} label="本月营收" value="¥12.8万" color="emerald" sub="环比 +12%" />
                <StatCard icon={Users} label="在读学员" value={stats.studentCount} color="blue" sub="新增 +15 人" />
                <StatCard icon={TrendingUp} label="满班率" value={`${stats.activeRate}%`} color="indigo" sub="优质" />
                <StatCard icon={AlertTriangle} label="待办预警" value={stats.alerts} color="orange" sub="需立即处理" />
            </div>

            {/* 图表区 (占位) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm min-h-[300px]">
                    <h3 className="font-bold text-gray-800 mb-4">营收趋势 (近30天)</h3>
                    <div className="h-64 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 border border-dashed border-gray-200">
                        [ Echarts 折线图区域 ]
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4">重要待办</h3>
                    <ul className="space-y-3">
                        <TodoItem text="审批 10 月份采购清单" tag="采购" color="blue" />
                        <TodoItem text="处理李某某家长的退费申请" tag="财务" color="red" />
                        <TodoItem text="确认下周公开课排期" tag="教务" color="orange" />
                    </ul>
                </div>
            </div>
        </div>
    );
}

// 内部小组件
function StatCard({ icon: Icon, label, value, color, sub }: any) {
    const colors: any = {
        emerald: 'bg-emerald-100 text-emerald-600',
        blue: 'bg-blue-100 text-blue-600',
        indigo: 'bg-indigo-100 text-indigo-600',
        orange: 'bg-orange-100 text-orange-600',
    };
    return (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]}`}>
                <Icon size={24} />
            </div>
            <div>
                <div className="text-sm text-gray-500 font-bold">{label}</div>
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
            </div>
        </div>
    );
}

function TodoItem({ text, tag, color }: any) {
    const badgeColors: any = { blue: 'bg-blue-100 text-blue-700', red: 'bg-red-100 text-red-700', orange: 'bg-orange-100 text-orange-700' };
    return (
        <li className="flex justify-between items-start p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
            <span className="text-sm text-gray-700">{text}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badgeColors[color]}`}>{tag}</span>
        </li>
    );
}