'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';

// 1. 更新接口定义
interface UserDetail {
    id: string;
    email: string;
    full_name: string;
    phone_number: string | null;
    gender: string | null;
    date_of_birth: string | null;
    blood_type: string | null;
    address: string | null;
    base_name: string | null;
    role_name: string | null;
    is_active: boolean;
}

interface Base { id: string; name: string; }

export default function UsersPage() {
    const { data: session } = useSession();
    const token = session?.user?.rawToken;

    const [users, setUsers] = useState<UserDetail[]>([]);
    const [bases, setBases] = useState<Base[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // --- 表单状态 ---
    // A. 基本信息
    const [fullName, setFullName] = useState("");
    const [gender, setGender] = useState("");
    const [dob, setDob] = useState("");
    const [bloodType, setBloodType] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    
    // B. 账号与权限
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [roleKey, setRoleKey] = useState("role.base.admin");
    const [selectedBase, setSelectedBase] = useState("");

    const fetchData = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const [usersRes, basesRes] = await Promise.all([
                fetch('http://localhost:8000/api/v1/tenant/users', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('http://localhost:8000/api/v1/bases', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            
            if (usersRes.ok) setUsers(await usersRes.json());
            if (basesRes.ok) setBases(await basesRes.json());
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [token]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!token) return;

        if (roleKey === 'role.base.admin' && !selectedBase) {
            alert("分店管理员必须选择一个归属基地");
            return;
        }

        const payload = {
            // 账号
            email, password, full_name: fullName,
            // 档案
            phone_number: phone || null,
            gender: gender || null,
            date_of_birth: dob || null,
            blood_type: bloodType || null,
            address: address || null,
            // 权限
            role_key: roleKey,
            base_id: selectedBase || null
        };

        try {
            const res = await fetch('http://localhost:8000/api/v1/tenant/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("创建失败");
            
            alert("员工创建成功");
            // 清空表单
            setEmail(""); setPassword(""); setFullName(""); setPhone(""); setAddress(""); setDob(""); setGender(""); setBloodType("");
            fetchData();
        } catch (e) {
            alert("创建失败，请检查邮箱是否重复");
        }
    };

    const getRoleLabel = (key: string | null) => {
        if (key === 'role.tenant.admin') return '👑 总部管理员';
        if (key === 'role.base.admin') return '🏢 分店校长';
        return key || '未知';
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">员工与权限管理</h1>

            {/* 创建表单 */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h2 className="text-xl font-semibold mb-4 border-b pb-2">新增员工档案</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* 1. 基本信息区域 */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">基本信息</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <input type="text" placeholder="真实姓名 *" value={fullName} onChange={e=>setFullName(e.target.value)} className="p-2 border rounded" required />
                            <select value={gender} onChange={e=>setGender(e.target.value)} className="p-2 border rounded">
                                <option value="">选择性别</option>
                                <option value="男">男</option>
                                <option value="女">女</option>
                            </select>
                            <input type="date" placeholder="出生日期" value={dob} onChange={e=>setDob(e.target.value)} className="p-2 border rounded text-gray-500" />
                            
                            <input type="text" placeholder="联系电话 *" value={phone} onChange={e=>setPhone(e.target.value)} className="p-2 border rounded" required />
                            <select value={bloodType} onChange={e=>setBloodType(e.target.value)} className="p-2 border rounded">
                                <option value="">选择血型</option>
                                <option value="A">A型</option>
                                <option value="B">B型</option>
                                <option value="AB">AB型</option>
                                <option value="O">O型</option>
                            </select>
                            <input type="text" placeholder="家庭住址" value={address} onChange={e=>setAddress(e.target.value)} className="p-2 border rounded md:col-span-1" />
                        </div>
                    </div>

                    {/* 2. 账号与权限区域 */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">账号与权限</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded">
                            <input type="email" placeholder="登录邮箱 (作为账号) *" value={email} onChange={e=>setEmail(e.target.value)} className="p-2 border rounded" required />
                            <input type="password" placeholder="初始密码 *" value={password} onChange={e=>setPassword(e.target.value)} className="p-2 border rounded" required />
                            
                            <div className="flex gap-2">
                                <select value={roleKey} onChange={e=>setRoleKey(e.target.value)} className="p-2 border rounded flex-1">
                                    <option value="role.base.admin">分店校长 (需选基地)</option>
                                    <option value="role.tenant.admin">总部管理员 (拥有最高权限)</option>
                                </select>
                                
                                <select value={selectedBase} onChange={e=>setSelectedBase(e.target.value)} className="p-2 border rounded flex-1" disabled={roleKey === 'role.tenant.admin'}>
                                    <option value="">-- 选择归属基地 --</option>
                                    {bases.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded hover:bg-blue-700 font-medium">
                        创建完整档案
                    </button>
                </form>
            </div>

            {/* 员工列表 */}
            <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
                <h2 className="text-xl font-semibold mb-4">员工花名册</h2>
                <table className="w-full text-left min-w-[800px]">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="p-3 text-xs font-medium text-gray-500 uppercase">姓名/性别</th>
                            <th className="p-3 text-xs font-medium text-gray-500 uppercase">联系方式</th>
                            <th className="p-3 text-xs font-medium text-gray-500 uppercase">账号</th>
                            <th className="p-3 text-xs font-medium text-gray-500 uppercase">职位/角色</th>
                            <th className="p-3 text-xs font-medium text-gray-500 uppercase">归属基地</th>
                            <th className="p-3 text-xs font-medium text-gray-500 uppercase">状态</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {users.map(u => (
                            <tr key={u.id} className="hover:bg-gray-50">
                                <td className="p-3">
                                    <div className="font-medium text-gray-900">{u.full_name || '-'}</div>
                                    <div className="text-xs text-gray-500">{u.gender} {u.blood_type ? `(${u.blood_type}型)` : ''}</div>
                                </td>
                                <td className="p-3 text-sm">
                                    <div>{u.phone_number || '-'}</div>
                                    <div className="text-xs text-gray-400 truncate max-w-[150px]">{u.address}</div>
                                </td>
                                <td className="p-3 text-sm text-gray-600">{u.email}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-xs ${u.role_name === 'role.tenant.admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                        {getRoleLabel(u.role_name)}
                                    </span>
                                </td>
                                <td className="p-3 text-sm">{u.base_name || <span className="text-gray-400">总部</span>}</td>
                                <td className="p-3 text-sm">
                                    {u.is_active ? <span className="text-green-600 font-medium">在职</span> : <span className="text-red-600">离职</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}