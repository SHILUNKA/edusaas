/*
 * B端后台: 总部全局看板 (V3.1 - 客户端 Fetch 修复版)
 * 路径: /tenant/dashboard
 * 修复: 客户端 ('use client') 必须 fetch 'localhost:8000' 
 * 而不是 'edusaas_core_api:8000'
 */
'use client'; 

console.log("✅ (Tenant Dashboard) 正在加载: /tenant/dashboard/page.tsx (V3.1)");

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react'; 
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, 
    Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

// --- (接口类型定义... 保持不变) ---
interface DashboardStats { total_bases: number; }
interface Course { id: string; }
interface HonorRank { id: string; }
interface MembershipTier { id: string; }
interface Material { id: string; }
interface AssetType { id: string; }
const mockParticipantActivity = [
    { month: '6月', active: 120 }, { month: '7月', active: 180 },
    { month: '8月', active: 160 }, { month: '9月', active: 250 },
    { month: '10月', active: 320 }, { month: '11月', active: 290 },
];

// --- 2. 页面组件 (★ 已修复) ---
export default function TenantDashboardPage() {
    
    const { data: session } = useSession();
    const token = session?.user?.rawToken; //

    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [counts, setCounts] = useState({
        courses: 0, ranks: 0, tiers: 0, materials: 0, assetTypes: 0,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // (数据获取函数... ★ 已修复)
    const fetchAllDashboardData = async () => {
        if (!token) return; 
        setIsLoading(true);
        setError(null);
        try {
            // (★ 关键修复!)
            // 浏览器 (客户端) 只能访问 localhost 上的映射端口
            const apiUrlBase = "http://localhost:8000"; //

            const [
                statsRes, coursesRes, ranksRes, tiersRes, materialsRes, assetTypesRes
            ] = await Promise.all([
                fetch(`${apiUrlBase}/api/v1/dashboard/stats`, { headers: { 'Authorization': `Bearer ${token}` }}),
                fetch(`${apiUrlBase}/api/v1/courses`, { headers: { 'Authorization': `Bearer ${token}` }}),
                fetch(`${apiUrlBase}/api/v1/honor-ranks`, { headers: { 'Authorization': `Bearer ${token}` }}),
                fetch(`${apiUrlBase}/api/v1/membership-tiers`, { headers: { 'Authorization': `Bearer ${token}` }}),
                fetch(`${apiUrlBase}/api/v1/materials`, { headers: { 'Authorization': `Bearer ${token}` }}),
                fetch(`${apiUrlBase}/api/v1/asset-types`, { headers: { 'Authorization': `Bearer ${token}` }}),
            ]);

            // (★ 关键) 检查所有响应是否都 OK
            const responses = [statsRes, coursesRes, ranksRes, tiersRes, materialsRes, assetTypesRes];
            for (const res of responses) {
                if (!res.ok) {
                    throw new Error(`API 请求失败: ${res.status} ${res.url}`);
                }
            }
            
            const statsData: DashboardStats = await statsRes.json();
            const coursesData: Course[] = await coursesRes.json();
            const ranksData: HonorRank[] = await ranksRes.json();
            const tiersData: MembershipTier[] = await tiersRes.json();
            const materialsData: Material[] = await materialsRes.json();
            const assetTypesData: AssetType[] = await assetTypesRes.json();

            setStats(statsData);
            setCounts({
                courses: coursesData.length, ranks: ranksData.length,
                tiers: tiersData.length, materials: materialsData.length,
                assetTypes: assetTypesData.length,
            });
        } catch (e) {
            console.error("Fetch data error:", e);
            setError((e as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    // (页面加载 hook... 保持不变)
    useEffect(() => {
        if (token) {
            fetchAllDashboardData();
        } else if (session) { 
             console.warn("Session 存在, 但 rawToken 缺失!");
             setError("Session 错误: 无法获取 API Token");
             setIsLoading(false);
        }
    }, [token, session]); 


    // --- 7. 页面渲染 (保持不变) ---
    if (isLoading) {
        return <div className="p-8">正在加载总部看板数据... (V3.1)</div>
    }
    if (error) {
        return <div className="p-8 text-red-500">加载失败: {error}</div>
    }

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-6">总部 · 全局看板</h1>
            
            {/* (KPI 卡片... 保持不变) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <KpiCard title="基地总数" value={stats?.total_bases ?? 0} />
                <KpiCard title="课程总数" value={counts.courses} />
                <KpiCard title="总学员数" value="320" subtitle=" (模拟数据)" />
                <KpiCard title="总销售额" value="¥ 85,200" subtitle="(模拟数据)" />
            </div>

            {/* (图表和状态... G) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4">月活学员 (MAU) 趋势 (模拟数据)</h2>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={mockParticipantActivity}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="active" name="月活学员数" stroke="#4f46e5" strokeWidth={2} activeDot={{ r: 8 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4">系统配置总览</h2>
                    <ul className="space-y-4 mt-6">
                        <StatusItem label="荣誉军衔" value={counts.ranks} />
                        <StatusItem label="会员卡种" value={counts.tiers} />
                        <StatusItem label="物料定义" value={counts.materials} />
                        <StatusItem label="资产类型" value={counts.assetTypes} />
                    </ul>
                </div>
            </div>
        </div>
    );
}

// --- (子组件 - KpiCard & StatusItem 保持不变) ---
function KpiCard({ title, value, subtitle }: { title: string, value: string | number, subtitle?: string }) {
    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-sm font-medium text-gray-500">{title}</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
    );
}
function StatusItem({ label, value }: { label: string, value: string | number }) {
    return (
        <li className="flex justify-between items-center">
            <span className="text-gray-600">{label}:</span>
            <span className="text-lg font-semibold text-indigo-600">{value}</span>
        </li>
    );
}