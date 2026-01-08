/*
 * 校区看板主视图 (V22.0 - 角色分发器)
 * 路径: web_admin/src/components/dashboard/CampusDashboardView.tsx
 */
'use client';

// 引入刚创建的 4 个子组件
import PrincipalDashboard from './base-roles/PrincipalDashboard';
import AcademicDashboard from './base-roles/AcademicDashboard';
import FinanceDashboard from './base-roles/FinanceDashboard';
import TeacherDashboard from './base-roles/TeacherDashboard';

export default function CampusDashboardView({ roles = [], baseName }: { roles: string[], baseName?: string }) {

    // 1. 优先匹配校长 (因为校长可能兼任其他角色，但优先看全盘)
    if (roles.includes('role.base.admin')) {
        return <PrincipalDashboard baseName={baseName} />;
    }

    // 2. 匹配职能管理岗
    if (roles.includes('role.base.academic')) {
        return <AcademicDashboard />;
    }

    if (roles.includes('role.base.finance')) {
        return <FinanceDashboard />;
    }

    // 3. 匹配普通教师 (兜底)
    // 只要有 teacher 角色，且没被上面拦截，就显示教师端
    if (roles.includes('role.teacher')) {
        return <TeacherDashboard />;
    }

    // 4. 异常兜底 (比如刚创建的号没给角色) - Soft UI Evolution styling
    return (
        <div className="p-12 text-center rounded-3xl"
            style={{
                background: 'linear-gradient(135deg, rgba(255, 182, 193, 0.12), rgba(255, 182, 193, 0.05))',
                boxShadow: '0 8px 32px rgba(255, 182, 193, 0.15)'
            }}>
            <h3 className="text-2xl font-bold mb-3" style={{ color: '#334155' }}>
                欢迎加入 {baseName}
            </h3>
            <p className="text-sm" style={{ color: '#64748B' }}>
                您的账号暂未分配具体角色权限，请联系校长设置。
            </p>
        </div>
    );
}