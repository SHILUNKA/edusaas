/*
 * 总部员工管理 (V18.0)
 * 路径: /tenant/users
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

interface User {
    id: string;
    email: string;
    full_name: string;
    role_name: string; // role.tenant.finance 等
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
            const res = await fetch(`${API}/tenant/users`, { headers: { 'Authorization': `Bearer ${token}` } });
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
            const res = await fetch(`${API}/tenant/users/${user.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ is_active: !user.is_active })
            });
            if (res.ok) fetchUsers(); else alert("操作失败");
        } catch (e) { alert("网络错误"); }
    };

    // 角色字典
    const roleMap: Record<string, string> = {
        'role.tenant.admin': '总经理 (BOSS)',
        'role.tenant.finance': '财务总监',
        'role.tenant.operation': '运营总监',
        'role.tenant.hr': '人事主管',
        'role.base.admin': '分校校长', // 列表里可能也会显示校长
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <Users className="text-indigo-600" size={32}/> 员工权限管理
                    </h1>
                    <p className="text-gray-500 mt-2">管理总部核心团队（财务、运营、人事）及查看分校负责人状态。</p>
                </div>
                <button onClick={() => setIsCreateOpen(true)} className="bg-black text-white px-5 py-2.5 rounded-full font-bold hover:bg-gray-800 flex items-center gap-2 shadow-lg transition-transform hover:scale-105">
                    <UserPlus size={20}/> 新增总部员工
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="p-5 text-xs font-bold text-gray-500 uppercase">姓名 / 邮箱</th>
                            <th className="p-5 text-xs font-bold text-gray-500 uppercase">当前角色</th>
                            <th className="p-5 text-xs font-bold text-gray-500 uppercase">状态</th>
                            <th className="p-5 text-xs font-bold text-gray-500 uppercase">入职时间</th>
                            <th className="p-5 text-right text-xs font-bold text-gray-500 uppercase">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {users.map(u => (
                            <tr key={u.id} className="hover:bg-gray-50 transition-colors group">
                                <td className="p-5">
                                    <div className="font-bold text-gray-900">{u.full_name}</div>
                                    <div className="text-sm text-gray-400 font-mono">{u.email}</div>
                                </td>
                                <td className="p-5">
                                    <span className={`px-2 py-1 rounded text-xs font-bold 
                                        ${u.role_name === 'role.tenant.admin' ? 'bg-purple-100 text-purple-700' : 
                                          u.role_name === 'role.tenant.finance' ? 'bg-green-100 text-green-700' : 
                                          'bg-blue-100 text-blue-700'}`}>
                                        {roleMap[u.role_name] || u.role_name}
                                    </span>
                                </td>
                                <td className="p-5">
                                    {u.is_active ? 
                                        <span className="flex items-center gap-1 text-green-600 text-sm font-bold"><CheckCircle size={14}/> 在职</span> : 
                                        <span className="flex items-center gap-1 text-gray-400 text-sm font-bold"><XCircle size={14}/> 离职/禁用</span>
                                    }
                                </td>
                                <td className="p-5 text-sm text-gray-500">
                                    {new Date(u.created_at).toLocaleDateString()}
                                </td>
                                <td className="p-5 text-right">
                                    {u.role_name !== 'role.tenant.admin' && ( // 不能封禁老板自己
                                        <button 
                                            onClick={() => toggleStatus(u)}
                                            className={`text-sm font-bold px-3 py-1.5 rounded transition-colors ${u.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
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

            {/* 新增员工弹窗 */}
            {isCreateOpen && <CreateUserModal token={token} onClose={() => setIsCreateOpen(false)} onSuccess={fetchUsers} />}
        </div>
    );
}

// 内部组件: 创建用户 (带随机密码)
function CreateUserModal({ token, onClose, onSuccess }: any) {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [role, setRole] = useState("role.tenant.finance");
    const [password, setPassword] = useState(() => Math.random().toString(36).slice(-8) + "!Aa1"); // 简单随机
    const [copied, setCopied] = useState(false);
    const API = API_BASE_URL;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API}/tenant/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    email, full_name: name, role_key: role, password: password,
                    // 总部员工 base_id 为 null
                    base_id: null,
                    phone_number: null, gender: null, blood_type: null, date_of_birth: null, address: null
                })
            });
            if (res.ok) { alert(`✅ 创建成功！\n账号: ${email}\n密码: ${password}\n请务必复制发送给员工。`); onSuccess(); onClose(); }
            else alert("创建失败，邮箱可能已存在");
        } catch (e) { alert("网络错误"); }
    };

    const copyPass = () => { navigator.clipboard.writeText(password); setCopied(true); };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl">
                <h3 className="text-xl font-bold mb-4">新增总部员工</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">岗位角色</label>
                        <select value={role} onChange={e=>setRole(e.target.value)} className="w-full p-3 border rounded-xl bg-white">
                            <option value="role.tenant.finance">💰 财务总监 (管理资金/审批)</option>
                            <option value="role.tenant.operation">📈 运营总监 (管理课程/资产)</option>
                            <option value="role.tenant.hr">👥 人事主管 (管理员工)</option>
                        </select>
                    </div>
                    <input required value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-3 border rounded-xl" placeholder="登录邮箱 (如 finance@hq.com)"/>
                    <input required value={name} onChange={e=>setName(e.target.value)} className="w-full p-3 border rounded-xl" placeholder="员工姓名"/>
                    
                    <div className="relative">
                        <label className="text-xs font-bold text-gray-500 block mb-1">初始密码</label>
                        <input readOnly value={password} className="w-full p-3 border rounded-xl bg-gray-50 font-mono"/>
                        <button type="button" onClick={copyPass} className="absolute right-3 top-8 text-indigo-600 font-bold text-sm">
                            {copied ? "已复制" : "复制"}
                        </button>
                    </div>

                    <div className="flex gap-2 justify-end mt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-500">取消</button>
                        <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold">确认创建</button>
                    </div>
                </form>
            </div>
        </div>
    );
}