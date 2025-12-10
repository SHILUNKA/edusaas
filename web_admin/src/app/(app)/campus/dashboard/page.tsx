/*
 * 统一看板入口 (V18.3)
 * 路径: /dashboard
 */
'use client';

import { useSession } from 'next-auth/react';
import { jwtDecode } from 'jwt-decode';
import { useMemo } from 'react';
import { LayoutDashboard } from 'lucide-react';
import TenantDashboardView from '@/components/dashboard/TenantDashboardView';
import CampusDashboardView from '@/components/dashboard/CampusDashboardView';

export default function DashboardPage() {
    const { data: session } = useSession();

    // 解析 Token 获取角色
    const { isTenantUser, baseName, roles } = useMemo(() => {
        const token = session?.user?.rawToken;
        if (!token) return { isTenantUser: false, baseName: '', roles: [] };
        try {
            const decoded: any = jwtDecode(token);
            const userRoles = decoded.roles || [];
            return {
                isTenantUser: userRoles.some((r: string) => r.startsWith('role.tenant')),
                baseName: decoded.base_name,
                roles: userRoles // ★ 提取角色数组
            };
        } catch { return { isTenantUser: false, baseName: '', roles: [] }; }
    }, [session]);

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex items-center gap-2 mb-8 text-gray-400 text-sm font-bold uppercase tracking-wider">
                <LayoutDashboard size={16}/> 
                <span>{isTenantUser ? "Headquarters" : "Campus"} Dashboard</span>
            </div>

            {/* ★ 将 roles 传递给子组件 */}
            {isTenantUser ? (
                <TenantDashboardView roles={roles} />
            ) : (
                <CampusDashboardView baseName={baseName} roles={roles} />
            )}
        </div>
    );
}