/*
 * 校区看板入口 (V25.0 - 真实数据版)
 * 路径: /base/dashboard
 */
'use client';

import { useSession } from 'next-auth/react';
import { jwtDecode } from 'jwt-decode';
import { useMemo } from 'react';
import { LayoutDashboard } from 'lucide-react';
import CampusDashboardView from '@/components/dashboard/BaseDashboardView';

export default function BaseDashboardPage() {
    const { data: session } = useSession();

    // 1. 解析角色与基地名
    const { baseName, roles } = useMemo(() => {
        const token = session?.user?.rawToken;
        if (!token) return { baseName: '校区', roles: [] };
        try {
            const decoded: any = jwtDecode(token);
            return {
                baseName: decoded.base_name || '校区',
                roles: decoded.roles || []
            };
        } catch { return { baseName: '校区', roles: [] }; }
    }, [session]);

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-2 mb-6 text-gray-400 text-sm font-bold uppercase tracking-wider">
                <LayoutDashboard size={16}/> 
                <span>Campus Operation System</span>
            </div>

            {/* 2. 调用分发视图 (传入必要参数) */}
            <CampusDashboardView roles={roles} baseName={baseName} />
        </div>
    );
}