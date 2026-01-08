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
        <div className="p-6 max-w-[1600px] mx-auto space-y-6 min-h-screen"
            style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)' }}>
            {/* Header with Soft UI styling */}
            <div className="flex items-center gap-3 mb-6 p-4 rounded-2xl"
                style={{
                    background: 'linear-gradient(135deg, rgba(144, 238, 144, 0.12), rgba(144, 238, 144, 0.05))',
                    boxShadow: '0 4px 16px rgba(144, 238, 144, 0.12)'
                }}>
                <LayoutDashboard size={20} style={{ color: '#90EE90' }} />
                <span className="text-sm font-bold uppercase tracking-wider" style={{ color: '#64748B' }}>
                    Campus Operation System · {baseName}
                </span>
            </div>

            {/* 2. 调用分发视图 (传入必要参数) */}
            <CampusDashboardView roles={roles} baseName={baseName} />
        </div>
    );
}