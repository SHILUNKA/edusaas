/*
 * 全局布局 (V17.1 - 修复: 基于角色的动态菜单)
 * 路径: web_admin/src/app/(app)/layout.tsx
 */
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
    LayoutDashboard, Building2, Users, BookOpen, 
    Package, CreditCard, Award, Settings, LogOut,
    Menu, Bell, Calendar, GraduationCap, School
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { jwtDecode } from 'jwt-decode'; // (需安装: npm install jwt-decode)
import { useMemo } from 'react';

// 定义 Token 载荷结构
interface TokenPayload {
    sub: string;
    roles: string[];
    tenant_id: string;
    base_id?: string;
    exp: number;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { data: session } = useSession();

    // --- 1. 解析角色与权限 ---
    const { roles, isTenantAdmin, isBaseAdmin } = useMemo(() => {
        const token = session?.user?.rawToken;
        if (!token) return { roles: [], isTenantAdmin: false, isBaseAdmin: false };
        
        try {
            const decoded = jwtDecode<TokenPayload>(token);
            const r = decoded.roles || [];
            return {
                roles: r,
                isTenantAdmin: r.includes('role.tenant.admin'),
                isBaseAdmin: r.includes('role.base.admin')
            };
        } catch (e) {
            return { roles: [], isTenantAdmin: false, isBaseAdmin: false };
        }
    }, [session]);

    // --- 2. 菜单配置 ---
    
    // A. 总部菜单 (Tenant Admin)
    const tenantNavItems = [
        { name: '全局看板', href: '/tenant/dashboard', icon: LayoutDashboard },
        { name: '财务中心', href: '/tenant/finance', icon: CreditCard },
        { name: '基地管理', href: '/tenant/bases', icon: Building2 },
        { name: '学员总览', href: '/tenant/participants', icon: Users },
        { name: '中央课程库', href: '/tenant/courses', icon: BookOpen },
        { name: '固定资产', href: '/tenant/assets', icon: Package },
        { name: '荣誉体系', href: '/admin/honor-ranks', icon: Award },
        { name: '会员卡种', href: '/tenant/membership-tiers', icon: CreditCard },
        { name: '员工权限', href: '/tenant/users', icon: Settings },
    ];

    // B. 基地菜单 (Base Admin) - (指向校区端页面)
    const campusNavItems = [
        { name: '校区工作台', href: '/campus/dashboard', icon: LayoutDashboard },
        { name: '排课/课表', href: '/campus/schedule', icon: Calendar },
        { name: '教务班级', href: '/campus/classes', icon: School }, // Class
        { name: '本校学员', href: '/campus/students', icon: GraduationCap }, // Student
        { name: '教职工管理', href: '/campus/staff', icon: Users },
        { name: '教室管理', href: '/campus/rooms', icon: Building2 }, // Room
    ];

    // C. 决策: 显示哪套菜单?
    // 优先显示总部菜单(如果是超管)，否则显示基地菜单
    const navItems = isTenantAdmin ? tenantNavItems : (isBaseAdmin ? campusNavItems : []);
    
    // 显示头衔
    const roleTitle = isTenantAdmin ? "总部管理员" : (isBaseAdmin ? "校区校长" : "教职工");
    const themeColor = isTenantAdmin ? "bg-indigo-600" : "bg-emerald-600"; // 总部蓝，校区绿，区分视觉

    return (
        <div className="flex h-screen bg-gray-50 font-sans text-gray-900">
            
            {/* 1. 侧边栏 (Sidebar) */}
            <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-20">
                {/* Logo Area */}
                <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950/50">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 shadow-lg ${isTenantAdmin ? 'bg-indigo-500' : 'bg-emerald-500'}`}>
                        <span className="font-bold text-lg">E</span>
                    </div>
                    <span className="font-bold text-lg tracking-wide text-slate-100">
                        {isTenantAdmin ? 'EduSaaS 总部' : 'EduSaaS 校区'}
                    </span>
                </div>

                {/* Nav Items */}
                <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
                    <div className="px-3 mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {isTenantAdmin ? 'Global Management' : 'Campus Operation'}
                    </div>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname.startsWith(item.href); // 优化匹配逻辑
                        const activeClass = isTenantAdmin ? 'bg-indigo-600' : 'bg-emerald-600'; // 动态高亮色

                        return (
                            <Link 
                                key={item.href} 
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                                    isActive 
                                    ? `${activeClass} text-white shadow-md` 
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                                }`}
                            >
                                <Icon size={18} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                {/* User Profile (Bottom) */}
                <div className="p-4 border-t border-slate-800 bg-slate-950/30">
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border border-white/10 ${isTenantAdmin ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                            {session?.user?.email?.[0].toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium text-slate-200 truncate" title={session?.user?.email || ''}>
                                {session?.user?.email}
                            </p>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                {roleTitle}
                            </p>
                        </div>
                        <button 
                            onClick={() => signOut({ callbackUrl: '/login' })} 
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                            title="退出登录"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* 2. 主内容区 */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm z-10">
                    <div className="flex items-center text-sm text-gray-500">
                        <span className="text-gray-400">当前位置</span>
                        <span className="mx-2">/</span>
                        <span className="text-gray-800 font-medium">
                            {navItems.find(i => pathname.startsWith(i.href))?.name || '控制台'}
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 relative">
                            <Bell size={20} />
                            {/* <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span> */}
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