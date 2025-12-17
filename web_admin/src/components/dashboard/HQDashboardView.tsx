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
    // 这样做的好处是：如果 Boss 同时想看 HR 数据，我们可以一次性传给他，不用子组件再发请求
    useEffect(() => {
        async function fetchData() {
            if (!token) return;
            setIsLoading(true);
            try {
                const headers = { 'Authorization': `Bearer ${token}` };
                
                // 并发请求所有可能用到的数据
                const [resBasic, resAdv, resStaff] = await Promise.all([
                    fetch(`${API_BASE_URL}/hq/dashboard/stats`, { headers }),
                    fetch(`${API_BASE_URL}/hq/dashboard/analytics`, { headers }),
                    fetch(`${API_BASE_URL}/hq/dashboard/pending-staff`, { headers })
                ]);

                if (resBasic.ok) setBasicStats(await resBasic.json());
                if (resAdv.ok) setAdvStats(await resAdv.json());
                if (resStaff.ok) setPendingStaff(await resStaff.json());

            } catch (e) {
                console.error("Fetch dashboard failed:", e);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [token]);

    if (isLoading) {
        return <div className="h-64 flex items-center justify-center text-gray-400"><Loader2 className="animate-spin mr-2"/> 加载集团数据...</div>;
    }

    // === 角色分发 ===

    // 1. 总经理 (看全盘)
    if (isBoss) {
        return <BossDashboard stats={{ basic: basicStats, adv: advStats }} />;
    }

    // 2. 财务总监
    if (isFinance) {
        return <FinanceDashboard />; // 财务数据暂用 Mock，如果后端好了可以传 props
    }

    // 3. 运营总监
    if (isOps) {
        return <OpsDashboard advStats={advStats} />;
    }

    // 4. 人事主管
    if (isHR) {
        return <HRDashboard pendingStaff={pendingStaff} />;
    }

    return <div>欢迎进入总部系统</div>;
}