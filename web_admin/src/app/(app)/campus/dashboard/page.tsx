/*
 * 校区端: 分店看板 (Dashboard) - V3.0 Pro UI 升级版
 * 路径: /campus/dashboard
 */
'use client';
import { API_BASE_URL } from '@/lib/config';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
// 引入专业图标库 (Next.js 默认支持)
import { 
    Calendar, Users, CreditCard, Package, Truck, 
    AlertTriangle, CheckCircle, Clock, ChevronRight, Plus
} from 'lucide-react';

// --- 接口定义 ---
interface BaseStats {
    participant_count: number;
    member_count: number;
    today_class_count: number;
}

interface StockAlert {
    material_id: string;
    name_key: string;
    current_stock: number;
}

interface ClassSchedule {
    id: string;
    course_name_key: string;
    start_time: string;
    end_time: string;
    room_name: string;
    teacher_name: string;
    status: string;
}

interface ProcurementOrder {
    status: string;
}

export default function CampusDashboardPage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const userBaseName = (session?.user as any)?.base_id ? "当前校区" : "";

    const [stats, setStats] = useState<BaseStats | null>(null);
    const [alerts, setAlerts] = useState<StockAlert[]>([]);
    const [todayClasses, setTodayClasses] = useState<ClassSchedule[]>([]);
    const [pendingReceipts, setPendingReceipts] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (token) fetchData();
    }, [token]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const headers = { 'Authorization': `Bearer ${token}` };

            const [statsRes, alertsRes, classesRes, ordersRes] = await Promise.all([
                fetch(`${API_BASE_URL}/base/dashboard/stats`, { headers }),
                fetch(`${API_BASE_URL}/base/stock/alerts`, { headers }),
                fetch(`${API_BASE_URL}/base/classes?date=today`, { headers }), // 获取今日课程详情
                fetch(`${API_BASE_URL}/procurements`, { headers }) // 获取订单算待办
            ]);

            if (statsRes.ok) setStats(await statsRes.json());
            if (alertsRes.ok) setAlerts(await alertsRes.json());
            
            if (classesRes.ok) {
                const classes = await classesRes.json();
                // 简单的排序，按开始时间
                setTodayClasses(classes.sort((a: any, b: any) => 
                    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
                ));
            }

            if (ordersRes.ok) {
                const orders: ProcurementOrder[] = await ordersRes.json();
                // 计算 "已发货" (shipped) 的订单数作为待办
                const count = orders.filter(o => o.status === 'shipped').length;
                setPendingReceipts(count);
            }

        } catch (e) {
            console.error("Dashboard fetch error:", e);
        } finally {
            setIsLoading(false);
        }
    };

    // 格式化时间 (10:30)
    const formatTime = (iso: string) => {
        return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* 1. 顶部欢迎栏 */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        🏫 {userBaseName}工作台
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm">
                        今天是 {new Date().toLocaleDateString()}，祝您教学工作顺利！
                    </p>
                </div>
                <div className="mt-4 md:mt-0 flex gap-3">
                    <Link href="/campus/participants/new" className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm">
                        <Plus size={16} /> 新生录入
                    </Link>
                </div>
            </div>

            {/* 2. 核心数据概览 (Stats) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                    label="今日课程" 
                    value={stats?.today_class_count ?? '-'} 
                    icon={<Calendar className="text-blue-600" size={24} />} 
                    bg="bg-blue-50"
                    border="border-blue-100"
                    href="/campus/schedule"
                />
                <StatCard 
                    label="在读学员" 
                    value={stats?.participant_count ?? '-'} 
                    icon={<Users className="text-green-600" size={24} />} 
                    bg="bg-green-50"
                    border="border-green-100"
                    href="/campus/participants"
                />
                <StatCard 
                    label="有效会员" 
                    value={stats?.member_count ?? '-'} 
                    icon={<CreditCard className="text-purple-600" size={24} />} 
                    bg="bg-purple-50"
                    border="border-purple-100"
                    href="/campus/memberships"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 3. 今日日程 (占据左侧 2/3) */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[500px]">
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <Clock size={18} className="text-gray-500"/> 今日日程
                        </h3>
                        <Link href="/campus/schedule" className="text-sm text-indigo-600 hover:underline">查看周历 &rarr;</Link>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5">
                        {isLoading ? (
                            <div className="space-y-3 animate-pulse">
                                {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-lg"></div>)}
                            </div>
                        ) : todayClasses.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <Calendar size={48} className="mb-2 opacity-20"/>
                                <p>今日暂无排课，好好休息吧 ~</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {todayClasses.map((cls, idx) => (
                                    <div key={idx} className="flex items-start gap-4 p-4 rounded-lg border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-colors">
                                        <div className="flex flex-col items-center min-w-[60px]">
                                            <span className="text-lg font-bold text-gray-900">{formatTime(cls.start_time)}</span>
                                            <span className="text-xs text-gray-400">{formatTime(cls.end_time)}</span>
                                        </div>
                                        <div className="w-1 h-10 bg-indigo-200 rounded-full mt-1"></div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-gray-800">{cls.course_name_key}</h4>
                                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                                <span className="flex items-center gap-1"><Users size={14}/> {cls.teacher_name || '待定'}</span>
                                                <span className="flex items-center gap-1">📍 {cls.room_name}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-medium">
                                                正常
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. 右侧功能区 (占据 1/3) */}
                <div className="space-y-6">
                    {/* 库存预警卡片 (优化版) */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 text-sm">库存监控</h3>
                            <Link href="/campus/stock" className="text-xs text-gray-500 hover:text-gray-900">管理 &rarr;</Link>
                        </div>
                        <div className="p-4">
                            {alerts.length === 0 ? (
                                <div className="flex items-center gap-3 text-green-600 bg-green-50 p-3 rounded-lg border border-green-100">
                                    <CheckCircle size={20} />
                                    <span className="text-sm font-medium">库存充足，暂无缺货风险</span>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {alerts.slice(0, 3).map((alert, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-2 rounded bg-red-50 border border-red-100">
                                            <span className="text-sm text-red-800 flex items-center gap-2">
                                                <AlertTriangle size={14} /> {alert.name_key}
                                            </span>
                                            <span className="text-sm font-bold text-red-600">{alert.current_stock}</span>
                                        </div>
                                    ))}
                                    {alerts.length > 3 && (
                                        <p className="text-xs text-center text-gray-400 mt-2">还有 {alerts.length - 3} 项预警...</p>
                                    )}
                                    <Link href="/campus/procurement" className="block w-full mt-3 text-center text-sm bg-white border border-red-200 text-red-600 py-1.5 rounded hover:bg-red-50 transition-colors">
                                        去申请补货
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 常用功能 (带通知) */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                        <h3 className="font-bold text-gray-800 mb-4 text-sm">快速操作</h3>
                        <div className="space-y-2">
                            <QuickActionLink 
                                href="/campus/memberships" 
                                icon={<CreditCard size={18} />} 
                                label="办理会员卡" 
                            />
                            <QuickActionLink 
                                href="/campus/stock" 
                                icon={<Package size={18} />} 
                                label="物料盘点" 
                            />
                            <div className="relative">
                                <QuickActionLink 
                                    href="/campus/procurement" 
                                    icon={<Truck size={18} />} 
                                    label="采购收货" 
                                />
                                {pendingReceipts > 0 && (
                                    <span className="absolute top-1/2 -translate-y-1/2 right-3 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse shadow-sm">
                                        {pendingReceipts} 待收
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- 子组件 ---

function StatCard({ label, value, icon, bg, border, href }: any) {
    return (
        <Link href={href} className={`group block p-6 rounded-xl bg-white border ${border} shadow-sm hover:shadow-md transition-all relative overflow-hidden`}>
            <div className={`absolute top-0 right-0 p-4 rounded-bl-2xl ${bg} opacity-50 transition-opacity group-hover:opacity-100`}>
                {icon}
            </div>
            <div className="relative z-10">
                <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
                <h2 className="text-3xl font-bold text-gray-900">{value}</h2>
            </div>
        </Link>
    );
}

function QuickActionLink({ href, icon, label }: any) {
    return (
        <Link href={href} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 text-gray-700 hover:text-indigo-600 transition-colors group border border-transparent hover:border-gray-100">
            <div className="flex items-center gap-3">
                <span className="text-gray-400 group-hover:text-indigo-500">{icon}</span>
                <span className="font-medium text-sm">{label}</span>
            </div>
            <ChevronRight size={16} className="text-gray-300 group-hover:text-indigo-400" />
        </Link>
    );
}