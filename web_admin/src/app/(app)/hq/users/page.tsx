/*
 * 总部员工管理 (V19.0 - Soft UI Evolution)
 * 路径: /hq/users
 * 功能: 总部招人(财务/运营)、员工离职封号
 */
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import {
    Users, UserPlus, Shield, ShieldOff,
    CheckCircle, XCircle, Search, Mail, RefreshCw, Copy, Check
} from 'lucide-react';

// ✨ 导入 Soft UI 组件库
import {
    SoftPageContainer,
    SoftHeader,
    SoftButton,
    SoftCard,
    SoftBadge,
    SoftInput,
    SoftSelect,
} from '@/components/ui/SoftUI';
import { SOFT_COLORS } from '@/lib/softui-theme';

interface User {
    id: string;
    email: string;
    full_name: string;
    role_name: string; // role.hq.finance 等
    is_active: boolean;
    created_at: string;
}

export default function TenantUsersPage() {
    const { data: session } = useSession();
    const token = session?.user?.rawToken;
    const API = API_BASE_URL;

    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // 加载员工列表
    const fetchUsers = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${API}/hq/users`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setUsers(await res.json());
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchUsers(); }, [token]);

    // 封禁/解封 (离职处理)
    const toggleStatus = async (user: User) => {
        const action = user.is_active ? "封禁 (离职)" : "解封 (复职)";
        if (!confirm(`确认要对 [${user.full_name}] 执行 ${action} 操作吗？\n\n封禁后该账号将无法登录。`)) return;

        try {
            const res = await fetch(`${API}/hq/users/${user.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ is_active: !user.is_active })
            });
            if (res.ok) fetchUsers(); else alert("操作失败");
        } catch (e) { alert("网络错误"); }
    };

    // 角色字典
    const roleMap: Record<string, string> = {
        'role.hq.admin': '总经理 (BOSS)',
        'role.hq.finance': '财务总监',
        'role.hq.operation': '运营总监',
        'role.hq.hr': '人事主管',
        'role.base.admin': '分校校长', // 列表里可能也会显示校长
    };

    // 角色Badge颜色映射
    const getRoleBadgeVariant = (role: string) => {
        if (role === 'role.hq.admin') return 'info';
        if (role === 'role.hq.finance') return 'success';
        return 'neutral';
    };

    return (
        <SoftPageContainer>
            {/* Header - 使用 SoftHeader 组件 */}
            <SoftHeader
                title="员工权限管理"
                subtitle="管理总部核心团队（财务、运营、人事）及查看分校负责人状态。"
                icon={<Users size={32} style={{ color: SOFT_COLORS.softBlue }} />}
                variant="blue"
                action={
                    <SoftButton
                        variant="blue"
                        onClick={() => setIsCreateOpen(true)}
                        icon={<UserPlus size={20} />}
                    >
                        新增总部员工
                    </SoftButton>
                }
            />

            {/* Table Card - 使用 SoftCard */}
            <SoftCard variant="white" padding="sm">
                <div className="overflow-x-auto rounded-2xl">
                    <table className="w-full text-left">
                        <thead className="border-b-2" style={{ borderColor: SOFT_COLORS.border }}>
                            <tr>
                                <th className="p-5 text-xs font-bold uppercase" style={{ color: SOFT_COLORS.textMuted }}>
                                    姓名 / 邮箱
                                </th>
                                <th className="p-5 text-xs font-bold uppercase" style={{ color: SOFT_COLORS.textMuted }}>
                                    当前角色
                                </th>
                                <th className="p-5 text-xs font-bold uppercase" style={{ color: SOFT_COLORS.textMuted }}>
                                    状态
                                </th>
                                <th className="p-5 text-xs font-bold uppercase" style={{ color: SOFT_COLORS.textMuted }}>
                                    入职时间
                                </th>
                                <th className="p-5 text-right text-xs font-bold uppercase" style={{ color: SOFT_COLORS.textMuted }}>
                                    操作
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: '#F1F5F9' }}>
                            {users.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="p-5">
                                        <div className="font-bold" style={{ color: SOFT_COLORS.text }}>
                                            {u.full_name}
                                        </div>
                                        <div className="text-sm font-mono" style={{ color: SOFT_COLORS.textMuted }}>
                                            {u.email}
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <SoftBadge variant={getRoleBadgeVariant(u.role_name)} size="md">
                                            {roleMap[u.role_name] || u.role_name}
                                        </SoftBadge>
                                    </td>
                                    <td className="p-5">
                                        {u.is_active ? (
                                            <div className="flex items-center gap-2">
                                                <CheckCircle size={16} style={{ color: SOFT_COLORS.success }} />
                                                <span className="text-sm font-semibold" style={{ color: SOFT_COLORS.success }}>
                                                    在职
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <XCircle size={16} style={{ color: SOFT_COLORS.textMuted }} />
                                                <span className="text-sm font-semibold" style={{ color: SOFT_COLORS.textMuted }}>
                                                    离职/禁用
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-5 text-sm" style={{ color: SOFT_COLORS.textMuted }}>
                                        {new Date(u.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="p-5 text-right">
                                        {u.role_name !== 'role.hq.admin' && ( // 不能封禁老板自己
                                            <button
                                                onClick={() => toggleStatus(u)}
                                                className="text-sm font-bold px-4 py-2 rounded-xl transition-all hover:scale-105"
                                                style={{
                                                    background: u.is_active
                                                        ? 'rgba(239, 68, 68, 0.1)'
                                                        : 'rgba(16, 185, 129, 0.1)',
                                                    color: u.is_active ? SOFT_COLORS.error : SOFT_COLORS.success,
                                                    border: `1.5px solid ${u.is_active ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                                                }}
                                            >
                                                {u.is_active ? "封禁账号" : "恢复启用"}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </SoftCard>

            {/* 新增员工弹窗 - 使用 Soft UI */}
            {isCreateOpen && <CreateUserModal token={token} onClose={() => setIsCreateOpen(false)} onSuccess={fetchUsers} />}
        </SoftPageContainer>
    );
}

// 内部组件: 创建用户 (带随机密码) - Soft UI Evolution
function CreateUserModal({ token, onClose, onSuccess }: any) {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [role, setRole] = useState("role.hq.finance");
    const [password, setPassword] = useState(() => Math.random().toString(36).slice(-8) + "!Aa1"); // 简单随机
    const [copied, setCopied] = useState(false);
    const API = API_BASE_URL;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API}/hq/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    email, full_name: name, role_key: role, password: password,
                    base_id: null,
                    phone_number: null, gender: null, blood_type: null, date_of_birth: null, address: null
                })
            });
            if (res.ok) {
                alert(`✅ 创建成功！\n账号: ${email}\n密码: ${password}\n请务必复制发送给员工。`);
                onSuccess();
                onClose();
            } else {
                alert("创建失败，邮箱可能已存在");
            }
        } catch (e) { alert("网络错误"); }
    };

    const copyPass = () => { navigator.clipboard.writeText(password); setCopied(true); };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <SoftCard variant="white" padding="lg" className="w-full max-w-md shadow-2xl">
                <h3 className="text-2xl font-bold mb-6" style={{ color: SOFT_COLORS.text }}>
                    新增总部员工
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <SoftSelect
                        label="岗位角色"
                        value={role}
                        onChange={e => setRole(e.target.value)}
                    >
                        <option value="role.hq.finance">💰 财务总监 (管理资金/审批)</option>
                        <option value="role.hq.operation">📈 运营总监 (管理课程/资产)</option>
                        <option value="role.hq.hr">👥 人事主管 (管理员工)</option>
                    </SoftSelect>

                    <SoftInput
                        required
                        type="email"
                        label="登录邮箱"
                        placeholder="如 finance@hq.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                    />

                    <SoftInput
                        required
                        label="员工姓名"
                        placeholder="请输入姓名"
                        value={name}
                        onChange={e => setName(e.target.value)}
                    />

                    <div className="relative">
                        <SoftInput
                            readOnly
                            label="初始密码"
                            value={password}
                            className="font-mono bg-gray-50"
                        />
                        <button
                            type="button"
                            onClick={copyPass}
                            className="absolute right-3 top-9 font-bold text-sm transition-all flex items-center gap-1"
                            style={{ color: copied ? SOFT_COLORS.success : SOFT_COLORS.softBlue }}
                        >
                            {copied ? <><Check size={14} /> 已复制</> : <><Copy size={14} /> 复制</>}
                        </button>
                    </div>

                    <div className="flex gap-3 justify-end mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl font-semibold transition-all hover:scale-105"
                            style={{ color: SOFT_COLORS.textMuted }}
                        >
                            取消
                        </button>
                        <SoftButton type="submit" variant="blue">
                            确认创建
                        </SoftButton>
                    </div>
                </form>
            </SoftCard>
        </div>
    );
}