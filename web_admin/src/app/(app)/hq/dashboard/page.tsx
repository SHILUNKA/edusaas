/*
 * 总部看板页 (V19.0 - 角色透传版)
 * 路径: web_admin/src/app/(app)/hq/dashboard/page.tsx
 * 职责: 解析当前用户角色，并传递给视图组件
 */
'use client';

import { useSession } from 'next-auth/react';
import { jwtDecode } from 'jwt-decode';
import { useMemo } from 'react';
import { LayoutDashboard } from 'lucide-react';
import TenantDashboardView from '@/components/dashboard/HQDashboardView';

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
        <div className="p-8 max-w-7xl mx-auto min-h-screen"
            style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)' }}>
            <div className="flex items-center gap-3 mb-8 p-4 rounded-2xl"
                style={{
                    background: 'linear-gradient(135deg, rgba(135, 206, 235, 0.1), rgba(135, 206, 235, 0.05))',
                    boxShadow: '0 4px 16px rgba(135, 206, 235, 0.1)'
                }}>
                <LayoutDashboard size={20} style={{ color: '#87CEEB' }} />
                <span className="text-sm font-bold uppercase tracking-wider" style={{ color: '#64748B' }}>
                    Headquarters Dashboard
                </span>
            </div>

            {/* 将角色数组传给视图组件，由它决定显示什么 */}
            <TenantDashboardView roles={roles} />
        </div>
    );
}