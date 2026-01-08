/*
 * 总部看板主视图 (V22.0 - 角色分发器)
 * 路径: web_admin/src/components/dashboard/TenantDashboardView.tsx
 */
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { Loader2 } from 'lucide-react';

// 引入子组件
import BossDashboard from './hq-roles/BossDashboard';
import FinanceDashboard from './hq-roles/FinanceDashboard';
import OpsDashboard from './hq-roles/OpsDashboard';
import HRDashboard from './hq-roles/HRDashboard';

export default function TenantDashboardView({ roles = [] }: { roles: string[] }) {
    const { data: session } = useSession();
    const token = session?.user?.rawToken;

    // 数据状态
    const [basicStats, setBasicStats] = useState<any>({});
    const [advStats, setAdvStats] = useState<any>({});
    const [pendingStaff, setPendingStaff] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // 权限判断
    const isBoss = roles.includes('role.hq.admin');
    const isFinance = roles.includes('role.hq.finance');
    const isOps = roles.includes('role.hq.operation');
    const isHR = roles.includes('role.hq.hr');

    // 统一数据获取 (Parent Fetch Pattern)
    // ✅ Only fetch data that the user role has permission to access
    useEffect(() => {
        async function fetchData() {
            if (!token) return;
            setIsLoading(true);
            try {
                const headers = { 'Authorization': `Bearer ${token}` };

                // ✅ Conditionally fetch based on roles
                const promises: Promise<any>[] = [];

                // Stats API - accessible by admin, finance
                if (isBoss || isFinance) {
                    promises.push(
                        fetch(`${API_BASE_URL}/hq/dashboard/stats`, { headers })
                            .then(res => res.ok ? res.json().then(data => ({ type: 'basic', data })) : null)
                    );
                }

                // Analytics API - accessible by admin, finance, operation
                if (isBoss || isFinance || isOps) {
                    promises.push(
                        fetch(`${API_BASE_URL}/hq/dashboard/analytics`, { headers })
                            .then(res => res.ok ? res.json().then(data => ({ type: 'adv', data })) : null)
                    );
                }

                // Pending staff API - accessible by admin, HR only
                if (isBoss || isHR) {
                    promises.push(
                        fetch(`${API_BASE_URL}/hq/dashboard/pending-staff`, { headers })
                            .then(res => res.ok ? res.json().then(data => ({ type: 'staff', data })) : null)
                    );
                }

                // ✅ Finance specific: Pending payment records for approval
                if (isBoss || isFinance) {
                    promises.push(
                        fetch(`${API_BASE_URL}/finance/payments?status=PENDING`, { headers })
                            .then(res => res.ok ? res.json().then(data => ({ type: 'pending_payments', data })) : null)
                    );
                }

                const results = await Promise.all(promises);

                // Process results
                results.forEach(result => {
                    if (!result) return;
                    if (result.type === 'basic') {
                        setBasicStats(result.data);
                    }
                    if (result.type === 'adv') setAdvStats(result.data);
                    if (result.type === 'staff') setPendingStaff(result.data);
                    if (result.type === 'pending_payments') {
                        // Attach to basicStats for finance dashboard to consume
                        setBasicStats((prev: any) => ({ ...prev, pending_payments: result.data }));
                    }
                });

            } catch (e) {
                console.error("Fetch dashboard failed:", e);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [token, isBoss, isFinance, isOps, isHR]);

    if (isLoading) {
        return <div className="h-64 flex items-center justify-center text-gray-400"><Loader2 className="animate-spin mr-2" /> 加载集团数据...</div>;
    }

    // === 角色分发 ===

    // 1. 总经理 (看全盘)
    if (isBoss) {
        return <BossDashboard stats={{ basic: basicStats, adv: advStats }} />;
    }

    // 2. 财务总监
    if (isFinance) {
        return <FinanceDashboard stats={{ basic: basicStats, adv: advStats }} />;
    }

    // 3. 运营总监
    if (isOps) {
        return <OpsDashboard advStats={advStats} />;
    }

    // 4. 人事主管
    if (isHR) {
        return <HRDashboard pendingStaff={pendingStaff} advStats={advStats} />;
    }

    return <div>欢迎进入总部系统</div>;
}