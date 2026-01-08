'use client';
import { TrendingUp, Building2, Wallet, Users, Map } from 'lucide-react';

export default function BossDashboard({ stats }: any) {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">集团运营驾驶舱</h2>
                    <p className="text-gray-500">上帝视角查看集团全盘数据。</p>
                </div>
                <div className="text-sm font-mono bg-purple-50 text-purple-700 px-3 py-1 rounded-full">
                    👑 总经理视图
                </div>
            </div>

            {/* 核心指标 (对接真实数据) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard icon={Building2} label="运营分校" value={stats?.basic?.total_bases || 0} unit="家" color="blue" />
                <StatCard icon={Users} label="集团总学员" value={stats?.basic?.total_students?.toLocaleString() || 0} unit="人" color="indigo" />
                <StatCard icon={Wallet} label="今日总营收" value={`¥${(stats?.basic?.today_revenue / 100).toLocaleString()}`} unit="" color="emerald" />
                <StatCard icon={TrendingUp} label="平均增长率" value={`+${stats?.basic?.revenue_growth_rate || 0}`} unit="%" color="purple" />
            </div>

            {/* 图表与地图 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 左侧：业绩排名 */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm md:col-span-1">
                    <h3 className="font-bold text-gray-800 mb-4">分校业绩排行榜 (Top 5)</h3>
                    <div className="space-y-4">
                        {stats?.basic?.base_rankings?.length > 0 ? (
                            stats.basic.base_rankings.map((base: any, idx: number) => {
                                // 计算一个相对百分比用于条形图显示 (以第一名为 100%)
                                const maxRevenue = stats.basic.base_rankings[0].total_income || 1;
                                const percent = Math.round(((base.total_income || 0) / maxRevenue) * 100);
                                return (
                                    <RankItem
                                        key={base.base_id}
                                        rank={idx + 1}
                                        name={base.base_name}
                                        amount={`¥${((base.total_income || 0) / 1000000).toFixed(1)}w`}
                                        percent={percent}
                                    />
                                );
                            })
                        ) : (
                            <div className="text-center py-8 text-gray-400 text-sm">暂无业绩数据</div>
                        )}
                    </div>
                </div>

                {/* 右侧：全国分布 (占位) */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm md:col-span-2 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
                    <Map size={48} className="mb-2 opacity-20" />
                    <span>[ Echarts 中国地图 / 业务分布热力图 ]</span>
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon: Icon, label, value, unit, color }: any) {
    const colors: any = { blue: 'text-blue-600 bg-blue-100', indigo: 'text-indigo-600 bg-indigo-100', emerald: 'text-emerald-600 bg-emerald-100', purple: 'text-purple-600 bg-purple-100' };
    return (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]}`}>
                <Icon size={24} />
            </div>
            <div>
                <div className="text-sm text-gray-500 font-bold">{label}</div>
                <div className="text-2xl font-bold text-gray-900">{value} <span className="text-sm text-gray-400 font-normal">{unit}</span></div>
            </div>
        </div>
    );
}

function RankItem({ rank, name, amount, percent }: any) {
    const colors = rank === 1 ? 'bg-yellow-400' : rank === 2 ? 'bg-gray-400' : rank === 3 ? 'bg-orange-400' : 'bg-blue-100 text-blue-600';
    return (
        <div>
            <div className="flex justify-between text-sm mb-1">
                <span className="font-bold text-gray-700 flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white ${colors}`}>{rank}</span>
                    {name}
                </span>
                <span className="font-mono font-bold">{amount}</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    );
}