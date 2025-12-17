'use client';
import { BarChart3, TrendingUp, UserPlus, Users } from 'lucide-react';

export default function OpsDashboard({ advStats }: any) {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">业务增长中心</h2>
                <div className="text-sm font-mono bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                    📈 运营视图
                </div>
            </div>

            {/* 运营核心数据 (真实数据对接) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-2 opacity-90 font-bold mb-2">
                        <TrendingUp size={20}/> 本周全局转化率
                    </div>
                    <div className="text-4xl font-bold">{advStats?.conversion_rate?.toFixed(1) || 0}%</div>
                    <div className="mt-4 text-sm bg-white/20 px-3 py-1 rounded-full w-fit">
                        新增潜客: {advStats?.new_leads_count || 0} 人
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-center">
                    <div className="flex items-center gap-3 text-gray-500 font-bold mb-2">
                        <BarChart3 className="text-orange-500"/> 本周体验课
                    </div>
                    <div className="text-3xl font-bold text-gray-900">{advStats?.trial_class_count || 0} <span className="text-sm text-gray-400 font-normal">节</span></div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-center">
                    <div className="flex items-center gap-3 text-gray-500 font-bold mb-2">
                        <UserPlus className="text-green-500"/> 新增正式会员
                    </div>
                    <div className="text-3xl font-bold text-gray-900">{advStats?.new_members_count || 0} <span className="text-sm text-gray-400 font-normal">人</span></div>
                </div>
            </div>

            {/* 漏斗分析 */}
            <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-6">全流程销售漏斗</h3>
                <div className="flex items-center justify-between px-10 text-center">
                    <FunnelStage label="线索获取" value={advStats?.new_leads_count || 0} color="bg-blue-100 text-blue-600" width="w-full" />
                    <Arrow />
                    <FunnelStage label="邀约试听" value={advStats?.trial_class_count || 0} color="bg-indigo-100 text-indigo-600" width="w-3/4" />
                    <Arrow />
                    <FunnelStage label="成交报名" value={advStats?.new_members_count || 0} color="bg-green-100 text-green-600" width="w-1/2" />
                </div>
            </div>
        </div>
    );
}

function FunnelStage({ label, value, color, width }: any) {
    return (
        <div className="flex flex-col items-center gap-2 w-1/3">
            <div className={`h-16 ${width} rounded-xl flex items-center justify-center font-bold text-xl ${color}`}>
                {value}
            </div>
            <span className="text-sm text-gray-500 font-bold">{label}</span>
        </div>
    );
}

function Arrow() {
    return <div className="text-gray-300 font-bold text-xl">→</div>;
}