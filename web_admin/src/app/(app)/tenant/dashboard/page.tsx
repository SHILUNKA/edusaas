/*
 * 总部端: 全局看板 (Dashboard) - V3.0 决策增强版
 * 路径: /tenant/dashboard
 */
'use client';

import { API_BASE_URL } from '@/lib/config';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Building2, Users, ClipboardCheck } from 'lucide-react';
// 引入图表组件
import ActivityChart from './ActivityChart';
// 引入新的品牌组件
import { StatCard } from '@/components/brand/StatCard';

// 定义数据接口
interface DashboardData {
    baseCount: number;
    courseCount: number;
    materialCount: number;
    assetTypeCount: number;
    membershipTierCount: number;
    rankCount: number;
    totalParticipantCount: number;
    pendingProcurementCount: number;
}

export default function TenantDashboardPage() {
    const { data: session } = useSession();
    const token = (session as any)?.user?.rawToken;

    const [data, setData] = useState<DashboardData>({
        baseCount: 0, courseCount: 0, materialCount: 0,
        assetTypeCount: 0, membershipTierCount: 0, rankCount: 0,
        totalParticipantCount: 0, pendingProcurementCount: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (token) fetchAllData();
    }, [token]);

    const fetchAllData = async () => {
        setIsLoading(true);
        const headers = { 'Authorization': `Bearer ${token}` };

        try {
            // 并行请求所有核心数据
            const results = await Promise.all([
                fetch(`${API_BASE_URL}/dashboard/stats`, { headers }),       // 1. 基地统计
                fetch(`${API_BASE_URL}/courses`, { headers }),               // 2. 课程
                fetch(`${API_BASE_URL}/materials`, { headers }),             // 3. 物料
                fetch(`${API_BASE_URL}/asset-types`, { headers }),           // 4. 资产类型
                fetch(`${API_BASE_URL}/membership-tiers`, { headers }),      // 5. 卡种
                fetch(`${API_BASE_URL}/honor-ranks`, { headers }),           // 6. 军衔
                fetch(`${API_BASE_URL}/tenant/participants`, { headers }),   // 7. 全网学员
                fetch(`${API_BASE_URL}/procurements`, { headers }),          // 8. 采购单
            ]);

            const [
                statsRes, coursesRes, materialsRes, assetsRes,
                tiersRes, ranksRes, partsRes, procsRes
            ] = results;

            const stats = statsRes.ok ? await statsRes.json() : { total_bases: 0 };
            const courses = coursesRes.ok ? await coursesRes.json() : [];
            const materials = materialsRes.ok ? await materialsRes.json() : [];
            const assets = assetsRes.ok ? await assetsRes.json() : [];
            const tiers = tiersRes.ok ? await tiersRes.json() : [];
            const ranks = ranksRes.ok ? await ranksRes.json() : [];
            const participants = partsRes.ok ? await partsRes.json() : [];
            const procurements = procsRes.ok ? await procsRes.json() : [];

            // 计算待审批数量
            const pendingCount = procurements.filter((p: any) => p.status === 'pending').length;

            setData({
                baseCount: stats.total_bases,
                courseCount: courses.length,
                materialCount: materials.length,
                assetTypeCount: assets.length,
                membershipTierCount: tiers.length,
                rankCount: ranks.length,
                totalParticipantCount: participants.length,
                pendingProcurementCount: pendingCount,
            });

        } catch (e) {
            console.error("Dashboard error:", e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* 头部 */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">👋 总部驾驶舱</h1>
                    <p className="text-muted-foreground mt-2">全网运营数据实时监控。</p>
                </div>
                <div className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                </div>
            </div>

            {/* 1. 核心指标卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 运营规模 */}
                <StatCard
                    title="运营分店 (基地)"
                    value={data.baseCount}
                    icon={<Building2 />}
                    description="活跃运营中"
                />

                {/* 用户规模 */}
                <StatCard
                    title="全网学员总数"
                    value={data.totalParticipantCount}
                    icon={<Users />}
                    description="较上月增长 12%"
                    trend="up"
                    trendValue="+12%"
                />

                {/* 待办事项: 采购审批 */}
                <Link href="/tenant/procurement" className="block group">
                    <StatCard
                        title="供应链待审批"
                        value={data.pendingProcurementCount}
                        icon={<ClipboardCheck className={data.pendingProcurementCount > 0 ? "text-red-500" : ""} />}
                        description={data.pendingProcurementCount > 0 ? "需立即处理" : "暂无待办"}
                        className={data.pendingProcurementCount > 0 ? "border-red-200 bg-red-50/10" : ""}
                        trend={data.pendingProcurementCount > 0 ? "down" : "neutral"}
                        trendValue={data.pendingProcurementCount > 0 ? "待处理" : "已清空"}
                    />
                </Link>
            </div>

            {/* 2. 图表与资源分布 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 左侧: 活跃度图表 */}
                <div className="lg:col-span-2">
                    <ActivityChart />
                </div>

                {/* 右侧: 资源库概览 */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800">中央资源库</h3>
                    <div className="grid grid-cols-1 gap-4">
                        <ResourceRow label="标准课程 (门)" value={data.courseCount} href="/tenant/courses" color="bg-purple-100 text-purple-700" />
                        <ResourceRow label="物料 SKU (种)" value={data.materialCount} href="/tenant/materials" color="bg-orange-100 text-orange-700" />
                        <ResourceRow label="固定资产类型" value={data.assetTypeCount} href="/tenant/assets" color="bg-indigo-100 text-indigo-700" />
                        <ResourceRow label="会员卡种" value={data.membershipTierCount} href="/tenant/membership-tiers" color="bg-teal-100 text-teal-700" />
                    </div>
                </div>
            </div>

            {/* 3. 快捷入口 */}
            <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4">管理快捷入口</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <QuickAction href="/tenant/bases" icon="➕" label="新开分店" desc="创建新基地并配置管理员" />
                    <QuickAction href="/tenant/users" icon="👥" label="人事管理" desc="员工账号与权限分配" />
                    <QuickAction href="/admin/honor-ranks" icon="🎖️" label="军衔体系" desc="调整晋升积分规则" />
                    <QuickAction href="/tenant/rooms" icon="🏫" label="场地管理" desc="查看各分店教室资源" />
                </div>
            </div>
        </div>
    );
}

// --- 子组件 ---

function ResourceRow({ label, value, href, color }: any) {
    return (
        <Link href={href} className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all group">
            <div className="flex items-center gap-3">
                <span className={`w-2 h-8 rounded-full ${color.split(' ')[0]}`}></span>
                <span className="text-gray-600 font-medium group-hover:text-gray-900">{label}</span>
            </div>
            <span className={`text-xl font-bold ${color.split(' ')[1]}`}>{value}</span>
        </Link>
    );
}

function QuickAction({ href, icon, label, desc }: any) {
    return (
        <Link href={href} className="flex flex-col p-4 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all group">
            <div className="text-2xl mb-2">{icon}</div>
            <div className="font-semibold text-gray-900">{label}</div>
            <div className="text-xs text-gray-500 mt-1">{desc}</div>
        </Link>
    );
}