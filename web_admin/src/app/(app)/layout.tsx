/*
 * 全局布局 (V19.3 - 供应链闭环菜单更新版)
 * 路径: web_admin/src/app/(app)/layout.tsx
 * 更新: 增加[我的进货单]和[库存变动记录]入口，完善 B2B 业务闭环
 */
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
    LayoutDashboard, Building2, Users, BookOpen, 
    Package, CreditCard, Award, Settings, LogOut,
    Bell, Calendar, GraduationCap, School, ShoppingCart, Briefcase,
    FileCheck, ShoppingBag, Truck, ClipboardList // ★ 新增图标引入
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { jwtDecode } from 'jwt-decode';
import { useMemo, useState, useEffect } from 'react';

// 引入 Logo 组件
import HqLogo from '@/components/HqLogo';
import DynamicBaseLogo from '@/components/DynamicBaseLogo';

// === 1. 定义菜单配置 (严格绑定角色) ===
const MENU_CONFIG = [
    // =================================
    // --- 总部菜单 (Tenant) ---
    // =================================
    { 
        name: '全局看板', 
        href: '/hq/dashboard', 
        icon: LayoutDashboard, 
        allowedRoles: ['role.hq.admin', 'role.hq.operation', 'role.hq.finance', 'role.hq.hr'] 
    },
    { 
        name: '财务中心', 
        href: '/hq/finance', 
        icon: CreditCard, 
        allowedRoles: ['role.hq.admin', 'role.hq.finance'] 
    },
    { 
        name: '基地管理', 
        href: '/hq/bases', 
        icon: Building2, 
        allowedRoles: ['role.hq.admin', 'role.hq.operation'] 
    },
    { 
        name: '学员总览', 
        href: '/hq/participants', 
        icon: Users, 
        allowedRoles: ['role.hq.admin', 'role.hq.operation'] 
    },
    { 
        name: '中央课程库', 
        href: '/hq/courses', 
        icon: BookOpen, 
        allowedRoles: ['role.hq.admin', 'role.hq.operation'] 
    },
    { 
        name: '固定资产', 
        href: '/hq/assets', 
        icon: Package, 
        allowedRoles: ['role.hq.admin', 'role.hq.operation', 'role.hq.finance'] 
    },
    // --- 供应链 (总部端) ---
    { 
        name: '商品管理', 
        href: '/hq/supply/products', 
        icon: Package, 
        allowedRoles: ['role.hq.admin', 'role.hq.operation', 'role.hq.finance'] 
    },
    { 
        name: '采购审批', 
        href: '/hq/supply/orders', 
        icon: ShoppingCart, 
        allowedRoles: ['role.hq.admin', 'role.hq.finance', 'role.hq.operation'] 
    },
    // --- 其他 ---
    { 
        name: '荣誉体系', 
        href: '/hq/honor-ranks', 
        icon: Award, 
        allowedRoles: ['role.hq.admin', 'role.hq.operation'] 
    },
    { 
        name: '会员卡种', 
        href: '/hq/membership-tiers', 
        icon: CreditCard, 
        allowedRoles: ['role.hq.admin', 'role.hq.operation'] 
    },
    { 
        name: '员工权限', 
        href: '/hq/users', 
        icon: Settings, 
        allowedRoles: ['role.hq.admin', 'role.hq.hr'] 
    },

    // =================================
    // --- 校区菜单 (Campus) ---
    // =================================
    { 
        name: '校区工作台', 
        href: '/base/dashboard', 
        icon: LayoutDashboard, 
        allowedRoles: ['role.base.admin', 'role.base.academic', 'role.base.finance', 'role.base.hr'] 
    },
    { 
        name: '排课/课表', 
        href: '/base/schedule', 
        icon: Calendar, 
        allowedRoles: ['role.base.admin', 'role.base.academic'] 
    },
    { 
        name: '教务班级', 
        href: '/base/classes', 
        icon: School, 
        allowedRoles: ['role.base.admin', 'role.base.academic'] 
    },
    { 
        name: '本校学员', 
        href: '/base/students', 
        icon: GraduationCap, 
        allowedRoles: ['role.base.admin', 'role.base.academic', 'role.base.finance'] 
    },
    { 
        name: '教职工管理', 
        href: '/base/staff', 
        icon: Briefcase, 
        allowedRoles: ['role.base.admin', 'role.base.hr'] 
    },
    { 
        name: '教室管理', 
        href: '/base/rooms', 
        icon: Building2, 
        allowedRoles: ['role.base.admin', 'role.base.academic'] 
    },
    
    // --- ★★★ 供应链采购 (对外) ★★★ ---
    { 
        name: '采购商城', 
        href: '/base/supply/market', 
        icon: ShoppingBag, 
        allowedRoles: ['role.base.admin', 'role.base.finance', 'role.base.academic'] 
    },
    { 
        name: '我的进货单', // 新增：用于付款、物流、收货
        href: '/base/supply/my-orders', 
        icon: Truck, 
        allowedRoles: ['role.base.admin', 'role.base.finance', 'role.base.academic'] 
    },

    // --- ★★★ 库存管理 (对内) ★★★ ---
    { 
        name: '库存台账', 
        href: '/base/inventory/stock', 
        icon: Package, 
        allowedRoles: ['role.base.admin', 'role.base.finance', 'role.base.academic'] 
    },
    { 
        name: '库存变动记录', // 新增：用于审计领用流水
        href: '/base/inventory/requests', 
        icon: ClipboardList, 
        allowedRoles: ['role.base.admin', 'role.base.finance', 'role.base.academic'] 
    },

    // --- 财务与销售 ---
    { 
        name: '财务支出', 
        href: '/base/finance/expenses', 
        icon: Calendar, 
        allowedRoles: ['role.base.admin', 'role.base.finance'] 
    },
    { 
        name: '销售订单管理', // To C 销售
        href: '/base/finance/orders', 
        icon: FileCheck, 
        allowedRoles: ['role.base.admin', 'role.base.finance', 'role.base.academic'] 
    },
    { 
        name: '财务审核', 
        href: '/base/audit', 
        icon: FileCheck, 
        allowedRoles: ['role.base.admin', 'role.base.finance'] 
    },
];

// 实时时钟组件
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

            // === 2. 核心过滤逻辑 ===
            // 只有当 item.allowedRoles 包含当前用户的任意一个角色时，才显示该菜单
            const filtered = MENU_CONFIG.filter(item => 
                item.allowedRoles.some(allowed => userRoles.includes(allowed))
            );

            // 识别身份
            const isTenant = userRoles.some(r => r.startsWith('role.hq'));
            const displayTitle = isTenant ? 'EduSaaS 集团总部' : (decoded.base_name || 'EduSaaS 智慧校区');

            // 头衔显示
            let title = '员工';
            if (userRoles.includes('role.hq.admin')) title = '总经理';
            else if (userRoles.includes('role.hq.finance')) title = '财务总监';
            else if (userRoles.includes('role.hq.operation')) title = '运营总监';
            else if (userRoles.includes('role.hq.hr')) title = '人事主管';
            else if (userRoles.includes('role.base.admin')) title = '校区校长';
            else if (userRoles.includes('role.base.finance')) title = '校区财务';
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

    // 样式配置
    const isIndigo = theme === 'indigo';
    const activeBgClass = isIndigo ? 'bg-indigo-600' : 'bg-emerald-600';
    const logoBgClass = isIndigo ? 'bg-indigo-500' : 'bg-emerald-500';

    return (
        <div className="flex h-screen bg-gray-50 font-sans text-gray-900">
            
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-20 transition-all duration-500">
                
                {/* Logo Area */}
                <div className="h-20 flex items-center px-6 border-b border-slate-800 bg-slate-950/30">
                    <div className="w-10 h-10 mr-3 shadow-lg rounded-lg overflow-hidden relative bg-slate-800 flex items-center justify-center">
                        {isTenantUser ? (
                            <HqLogo className="w-full h-full object-cover" viewBox="0 0 600 400" />
                        ) : (
                            <DynamicBaseLogo location={appTitle} hideText={true} className="w-full h-full object-cover"/>
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
                            <p className="text-xs text-slate-500 truncate" title={userTitle}>{userTitle}</p>
                        </div>
                        <button onClick={() => signOut({ callbackUrl: '/login' })} className="p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-slate-800 transition-colors" title="退出登录">
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