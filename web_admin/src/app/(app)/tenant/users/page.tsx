/*
 * B端后台: 员工与权限管理 (V5.0 - 自动生成密码版)
 * 路径: src/app/(app)/tenant/users/page.tsx
 */
'use client';

import { API_BASE_URL } from '@/lib/config';
import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';

// --- 1. 类型定义 ---

interface UserDetail {
    id: string;
    email: string;
    full_name: string;
    // 详细档案字段
    phone_number: string | null;
    gender: string | null;
    date_of_birth: string | null;
    blood_type: string | null;
    address: string | null;
    // 权限与状态
    base_name: string | null;
    role_name: string | null;
    is_active: boolean;
    // (★ 新增) 仅在创建成功时返回
    initial_password?: string; 
}

interface Base { 
    id: string; 
    name: string; 
}

// --- 2. 组件实现 ---

export default function UsersPage() {
    const { data: session } = useSession();
    const token = session?.user?.rawToken;

    // --- 状态管理 ---
    const [users, setUsers] = useState<UserDetail[]>([]);
    const [bases, setBases] = useState<Base[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // 表单状态: A. 基本信息
    const [fullName, setFullName] = useState("");
    const [gender, setGender] = useState("");
    const [dob, setDob] = useState("");
    const [bloodType, setBloodType] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    
    // 表单状态: B. 账号与权限
    const [email, setEmail] = useState("");
    // (★ 移除) const [password, setPassword] = useState(""); 
    const [roleKey, setRoleKey] = useState("role.teacher");
    const [selectedBase, setSelectedBase] = useState("");

    // --- 数据获取 ---
    const fetchData = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const [usersRes, basesRes] = await Promise.all([
                fetch(`${API_BASE_URL}/tenant/users`, { 
                    headers: { 'Authorization': `Bearer ${token}` } 
                }),
                fetch(`${API_BASE_URL}/bases`, { 
                    headers: { 'Authorization': `Bearer ${token}` } 
                })
            ]);
            
            if (usersRes.ok) setUsers(await usersRes.json());
            if (basesRes.ok) setBases(await basesRes.json());
        } catch (e) {
            console.error("Fetch error:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [token]);

    // --- 表单提交 ---
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!token) return;

        // 校验: 非总部管理员必须选择基地
        if (roleKey !== 'role.tenant.admin' && !selectedBase) {
            alert("分店校长或普通教师必须选择一个归属基地");
            return;
        }

        const payload = {
            // 账号
            email, 
            // password, // (★ 不再发送密码)
            full_name: fullName,
            // 档案
            phone_number: phone || null,
            gender: gender || null,
            date_of_birth: dob || null,
            blood_type: bloodType || null,
            address: address || null,
            // 权限
            role_key: roleKey,
            base_id: selectedBase // 必填
        };

        try {
            const res = await fetch('${API_BASE_URL}/tenant/users', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `创建失败 (${res.status})`);
            }
            
            const newUser: UserDetail = await res.json();

            // (★ 关键) 弹窗显示生成的密码
            alert(`✅ 员工创建成功！\n\n账号: ${newUser.email}\n初始密码: ${newUser.initial_password}\n\n请务必复制并告知员工，此密码只显示一次！`);

            // 清空所有表单
            setEmail(""); 
            setFullName(""); setPhone(""); setAddress(""); 
            setDob(""); setGender(""); setBloodType("");
            // 刷新列表
            fetchData();
        } catch (e: any) {
            alert(e.message || "创建失败，请检查邮箱是否重复");
        }
    };

    // --- 辅助函数 ---
    const getRoleLabel = (key: string | null) => {
        switch (key) {
            case 'role.tenant.admin': return '👑 总部管理员';
            case 'role.base.admin': return '🏢 分店校长';
            case 'role.teacher': return '🧑‍🏫 普通教师';
            default: return key || '未知角色';
        }
    };

    const getRoleBadgeColor = (key: string | null) => {
        switch (key) {
            case 'role.tenant.admin': return 'bg-purple-100 text-purple-800';
            case 'role.base.admin': return 'bg-blue-100 text-blue-800';
            case 'role.teacher': return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    // --- 页面渲染 ---
    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">员工与权限管理</h1>

            {/* 1. 新增员工表单 */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-gray-200">
                <h2 className="text-xl font-semibold mb-4 border-b pb-2 text-gray-800">新增员工档案</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* 区域 A: 基本信息 */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">A. 基本档案</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs text-gray-500">真实姓名 *</label>
                                <input type="text" value={fullName} onChange={e=>setFullName(e.target.value)} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" required />
                            </div>
                            
                            <div className="space-y-1">
                                <label className="text-xs text-gray-500">联系电话 *</label>
                                <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" required />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-gray-500">出生日期</label>
                                <input type="date" value={dob} onChange={e=>setDob(e.target.value)} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none text-gray-600" />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-gray-500">性别</label>
                                <select value={gender} onChange={e=>setGender(e.target.value)} className="w-full p-2 border rounded bg-white">
                                    <option value="">-- 请选择 --</option>
                                    <option value="男">男</option>
                                    <option value="女">女</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-gray-500">血型</label>
                                <select value={bloodType} onChange={e=>setBloodType(e.target.value)} className="w-full p-2 border rounded bg-white">
                                    <option value="">-- 请选择 --</option>
                                    <option value="A">A型</option>
                                    <option value="B">B型</option>
                                    <option value="AB">AB型</option>
                                    <option value="O">O型</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-gray-500">家庭住址</label>
                                <input type="text" value={address} onChange={e=>setAddress(e.target.value)} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                        </div>
                    </div>

                    {/* 区域 B: 账号与权限 */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">B. 账号与权限配置</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-md border border-gray-100">
                            {/* 左侧：账号 */}
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-500">登录邮箱 (作为账号) *</label>
                                    <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-2 border rounded" required />
                                </div>
                                
                                {/* (★ 关键修改: 初始密码改为只读提示) */}
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-500">初始密码</label>
                                    <div className="w-full p-2 border rounded bg-gray-100 text-gray-500 text-sm italic">
                                        (系统将自动生成8位强密码，创建成功后显示)
                                    </div>
                                </div>
                            </div>

                            {/* 右侧：权限 */}
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-500">系统角色 *</label>
                                    <select value={roleKey} onChange={e=>setRoleKey(e.target.value)} className="w-full p-2 border rounded bg-white">
                                        <option value="role.teacher">🧑‍🏫 普通教师 (需选基地)</option>
                                        <option value="role.base.admin">🏢 分店校长 (需选基地)</option>
                                        {/* (移除 role.tenant.admin) */}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs text-gray-500">归属基地 *</label>
                                    <select 
                                        value={selectedBase} 
                                        onChange={e=>setSelectedBase(e.target.value)} 
                                        className="w-full p-2 border rounded bg-white"
                                        required
                                    >
                                        <option value="">-- 请选择归属基地 --</option>
                                        {bases.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                    <p className="text-xs text-gray-400 mt-1">* 所有员工必须归属于某个分店基地</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-md hover:bg-indigo-700 font-medium shadow-sm transition-colors">
                        创建并启用账号
                    </button>
                </form>
            </div>

            {/* 2. 员工列表 */}
            <div className="bg-white p-6 rounded-lg shadow-md overflow-hidden border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">员工花名册</h2>
                    <span className="text-sm text-gray-500">共 {users.length} 人</span>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[900px]">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase">姓名 / 性别</th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase">联系方式 / 住址</th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase">账号信息</th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase">角色权限</th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase">归属</th>
                                <th className="p-3 text-xs font-bold text-gray-500 uppercase">状态</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {users.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-3">
                                        <div className="font-medium text-gray-900">{u.full_name || '-'}</div>
                                        <div className="text-xs text-gray-500 mt-0.5">
                                            {u.gender || '未知'} 
                                            {u.blood_type ? ` · ${u.blood_type}型` : ''}
                                            {u.date_of_birth ? ` · ${u.date_of_birth}` : ''}
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <div className="text-sm text-gray-900">{u.phone_number || '-'}</div>
                                        {u.address && (
                                            <div className="text-xs text-gray-400 truncate max-w-[180px] mt-0.5" title={u.address}>
                                                {u.address}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3 text-sm text-gray-600 font-mono">
                                        {u.email}
                                    </td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(u.role_name)}`}>
                                            {getRoleLabel(u.role_name)}
                                        </span>
                                    </td>
                                    <td className="p-3 text-sm text-gray-700">
                                        {u.base_name || <span className="text-gray-400 italic">总部</span>}
                                    </td>
                                    <td className="p-3 text-sm">
                                        {u.is_active 
                                            ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">在职</span> 
                                            : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">离职</span>
                                        }
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500">
                                        暂无员工数据，请在上方添加。
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}