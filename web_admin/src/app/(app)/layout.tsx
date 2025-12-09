/*
 * 全局布局 (V17.9 - SVG 组件化 Logo 版)
 * 路径: web_admin/src/app/(app)/layout.tsx
 * 更新: 弃用图片 URL，改用 HqLogo 和 DynamicBaseLogo 组件实时渲染
 */
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
    LayoutDashboard, Building2, Users, BookOpen, 
    Package, CreditCard, Award, Settings, LogOut,
    Bell, Calendar, GraduationCap, School, ShoppingCart
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { jwtDecode } from 'jwt-decode';
import { useMemo, useState, useEffect } from 'react';

// ★ 1. 引入我们封装好的 Logo 组件
import HqLogo from '@/components/HqLogo';
import DynamicBaseLogo from '@/components/DynamicBaseLogo';

// 菜单配置 (保持不变)
const MENU_CONFIG = [
    { name: '全局看板', href: '/tenant/dashboard', icon: LayoutDashboard, allowedRoles: ['role.tenant.admin', 'role.tenant.operation', 'role.tenant.finance'] },
    { name: '财务中心', href: '/tenant/finance', icon: CreditCard, allowedRoles: ['role.tenant.admin', 'role.tenant.finance'] },
    { name: '基地管理', href: '/tenant/bases', icon: Building2, allowedRoles: ['role.tenant.admin', 'role.tenant.operation'] },
    { name: '学员总览', href: '/tenant/participants', icon: Users, allowedRoles: ['role.tenant.admin', 'role.tenant.operation'] },
    { name: '中央课程库', href: '/tenant/courses', icon: BookOpen, allowedRoles: ['role.tenant.admin', 'role.tenant.operation'] },
    { name: '固定资产', href: '/tenant/assets', icon: Package, allowedRoles: ['role.tenant.admin', 'role.tenant.operation', 'role.tenant.finance'] },
    { name: '采购审批', href: '/tenant/procurements', icon: ShoppingCart, allowedRoles: ['role.tenant.admin', 'role.tenant.finance', 'role.tenant.operation'] },
    { name: '荣誉体系', href: '/admin/honor-ranks', icon: Award, allowedRoles: ['role.tenant.admin', 'role.tenant.operation'] },
    { name: '会员卡种', href: '/tenant/membership-tiers', icon: CreditCard, allowedRoles: ['role.tenant.admin', 'role.tenant.operation'] },
    { name: '员工权限', href: '/tenant/users', icon: Settings, allowedRoles: ['role.tenant.admin', 'role.tenant.hr'] },

    { name: '校区工作台', href: '/campus/dashboard', icon: LayoutDashboard, allowedRoles: ['role.base.admin', 'role.base.academic', 'role.base.finance'] },
    { name: '排课/课表', href: '/campus/schedule', icon: Calendar, allowedRoles: ['role.base.admin', 'role.base.academic'] },
    { name: '教务班级', href: '/campus/classes', icon: School, allowedRoles: ['role.base.admin', 'role.base.academic'] },
    { name: '本校学员', href: '/campus/students', icon: GraduationCap, allowedRoles: ['role.base.admin', 'role.base.academic', 'role.base.finance'] },
    { name: '教职工管理', href: '/campus/staff', icon: Users, allowedRoles: ['role.base.admin', 'role.base.hr'] },
    { name: '教室管理', href: '/campus/rooms', icon: Building2, allowedRoles: ['role.base.admin', 'role.base.academic'] },
    { name: '采购申请', href: '/campus/procurements', icon: Package, allowedRoles: ['role.base.admin', 'role.base.finance', 'role.base.academic'] },
];

// 实时时钟组件 (保持不变)
function RealTimeClock() {
    const [time, setTime] = useState(new Date());
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    if (!mounted) return null;
    return (
        <div className="flex flex-col items-end mr-4">
            <div className="text-lg font-mono font-bold text-gray-800 leading-none">
                {time.toLocaleTimeString('zh-CN', { hour12: false })}
            </div>
            <div className="text-xs text-gray-400 font-medium mt-1">
                {time.toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
        </div>
    );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { data: session } = useSession();

    const { visibleNavItems, theme, userTitle, appTitle, isTenantUser } = useMemo(() => {
        const token = session?.user?.rawToken;
        if (!token) return { visibleNavItems: [], theme: 'indigo', userTitle: '访客', appTitle: 'EduSaaS', isTenantUser: false };

        try {
            const decoded: any = jwtDecode(token);
            const userRoles: string[] = decoded.roles || [];

            // 1. 过滤菜单
            const filtered = MENU_CONFIG.filter(item => 
                item.allowedRoles.some(role => userRoles.includes(role))
            );

            // 2. 识别身份
            const isTenant = userRoles.some(r => r.startsWith('role.tenant'));
            
            // 3. 决定标题 (基地名 或 集团名)
            const displayTitle = isTenant ? 'EduSaaS 集团总部' : (decoded.base_name || 'EduSaaS 智慧校区');

            // 4. 头衔
            let title = '普通用户';
            if (userRoles.includes('role.tenant.admin')) title = '总经理';
            else if (userRoles.includes('role.base.admin')) title = '校区校长';
            else if (userRoles.includes('role.base.academic')) title = '教务主管';

            return {
                visibleNavItems: filtered,
                theme: isTenant ? 'indigo' : 'emerald',
                userTitle: title,
                appTitle: displayTitle,
                isTenantUser: isTenant
            };

        } catch (e) {
            return { visibleNavItems: [], theme: 'indigo', userTitle: '', appTitle: 'EduSaaS', isTenantUser: false };
        }
    }, [session]);

    // 样式辅助
    const isIndigo = theme === 'indigo';
    const activeBgClass = isIndigo ? 'bg-indigo-600' : 'bg-emerald-600';
    const logoBgClass = isIndigo ? 'bg-indigo-500' : 'bg-emerald-500';

    return (
        <div className="flex h-screen bg-gray-50 font-sans text-gray-900">
            
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-20 transition-all duration-500">
                {/* 1. Logo 区域 (V17.9 核心修改) */}
                <div className="h-20 flex items-center px-6 border-b border-slate-800 bg-slate-950/30">
                    
                    {/* Logo 容器: 增加 overflow-hidden 以适配圆角 */}
                    <div className="w-10 h-10 mr-3 shadow-lg rounded-lg overflow-hidden relative bg-slate-800 flex items-center justify-center">
                        {isTenantUser ? (
                            // A. 总部: 使用 HqLogo 组件
                            <HqLogo 
                                className="w-full h-full object-cover" 
                                viewBox="0 0 600 400" 
                                // 如果不想显示原SVG的深蓝背景，可以在这里通过CSS覆盖，或者保留原样
                            />
                        ) : (
                            // B. 基地: 使用 DynamicBaseLogo 组件
                            // location 传入 "北京朝阳..."，组件内部会自动匹配 "北京" 并显示长城
                            <DynamicBaseLogo 
                                location={appTitle} 
                                hideText={true} 
                                className="w-full h-full object-cover"
                            />
                        )}
                    </div>

                    <div className="flex flex-col">
                        <span className="font-bold text-sm tracking-wide text-slate-100 leading-tight">
                            {appTitle}
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Operation System</span>
                    </div>
                </div>

                {/* Nav Items */}
                <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
                    {visibleNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname.startsWith(item.href);
                        return (
                            <Link 
                                key={item.href} 
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                                    isActive 
                                    ? `${activeBgClass} text-white shadow-md` 
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                                }`}
                            >
                                <Icon size={18} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                {/* User Profile */}
                <div className="p-4 border-t border-slate-800 bg-slate-950/30">
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full bg-opacity-20 flex items-center justify-center text-sm font-bold border border-white/10 ${logoBgClass}`}>
                            {session?.user?.email?.[0].toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium text-slate-200 truncate">{session?.user?.email}</p>
                            <p className="text-xs text-slate-500">{userTitle}</p>
                        </div>
                        <button onClick={() => signOut({ callbackUrl: '/login' })} className="p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-slate-800 transition-colors">
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm z-10">
                    <div className="flex items-center text-sm text-gray-500">
                        <span className="text-gray-400">位置</span>
                        <span className="mx-2">/</span>
                        <span className="text-gray-800 font-bold text-lg">
                            {visibleNavItems.find(i => pathname.startsWith(i.href))?.name || '控制台'}
                        </span>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden md:block border-r border-gray-100 pr-6">
                            <RealTimeClock />
                        </div>
                        <button className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 relative">
                            <Bell size={22} />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto bg-gray-50">
                    {children}
                </div>
            </main>
        </div>
    );
}