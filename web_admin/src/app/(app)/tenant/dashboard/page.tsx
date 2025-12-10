/*
 * 总部看板页 (V19.0 - 角色透传版)
 * 路径: web_admin/src/app/(app)/tenant/dashboard/page.tsx
 * 职责: 解析当前用户角色，并传递给视图组件
 */
'use client';

import { useSession } from 'next-auth/react';
import { jwtDecode } from 'jwt-decode';
import { useMemo } from 'react';
import { LayoutDashboard } from 'lucide-react';
import TenantDashboardView from '@/components/dashboard/TenantDashboardView';

export default function TenantDashboardPage() {
    const { data: session } = useSession();

    // 解析 Token 获取角色列表
    const roles = useMemo(() => {
        const token = session?.user?.rawToken;
        if (!token) return [];
        try { 
            const decoded: any = jwtDecode(token);
            return decoded.roles || []; 
        } catch { return []; }
    }, [session]);

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex items-center gap-2 mb-8 text-gray-400 text-sm font-bold uppercase tracking-wider">
                <LayoutDashboard size={16}/> <span>Headquarters Dashboard</span>
            </div>
            
            {/* 将角色数组传给视图组件，由它决定显示什么 */}
            <TenantDashboardView roles={roles} />
        </div>
    );
}