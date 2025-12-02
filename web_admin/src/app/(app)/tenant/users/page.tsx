/*
 * B端后台: 员工与权限管理 (V14.0 - 组织架构版)
 * 路径: src/app/(app)/tenant/users/page.tsx
 * 升级: 左右分栏布局，左侧组织树，右侧员工列表 + 统计卡片
 */
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { Search, UserPlus, Users, Briefcase, ShieldCheck } from 'lucide-react';
import TeacherConfigModal from './TeacherConfigModal';
import OrgTree from './OrgTree';

// --- 类型定义 ---
interface UserDetail {
    id: string;
    email: string;
    full_name: string;
    phone_number: string | null;
    role_name: string | null;
    base_name: string | null;
    base_id: string | null; // (★ 新增字段)
    is_active: boolean;
    is_teaching_now?: boolean;
    skills?: string;
    initial_password?: string; 
    // 忽略其他不展示字段...
}
interface Base { id: string; name: string; }

export default function UsersPage() {
    const { data: session } = useSession();
    const token = session?.user?.rawToken;

    // 数据状态
    const [allUsers, setAllUsers] = useState<UserDetail[]>([]); // 全量数据
    const [filteredUsers, setFilteredUsers] = useState<UserDetail[]>([]); // 展示数据
    const [bases, setBases] = useState<Base[]>([]);
    
    // 筛选状态
    const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    
    // UI状态
    const [configTeacher, setConfigTeacher] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    // --- 初始化 ---
    const fetchData = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const [usersRes, basesRes] = await Promise.all([
                fetch(`${API_BASE_URL}/tenant/users`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/bases`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            
            if (usersRes.ok) setAllUsers(await usersRes.json());
            if (basesRes.ok) setBases(await basesRes.json());
        } catch (e) { console.error(e); } 
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchData(); }, [token]);

    // --- 核心筛选逻辑 ---
    useEffect(() => {
        let res = allUsers;

        // 1. 组织架构筛选
        if (selectedBaseId) {
            res = res.filter(u => u.base_id === selectedBaseId);
        }

        // 2. 关键词筛选
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            res = res.filter(u => 
                u.full_name?.toLowerCase().includes(q) || 
                u.email.toLowerCase().includes(q) ||
                u.phone_number?.includes(q)
            );
        }

        setFilteredUsers(res);
    }, [selectedBaseId, searchQuery, allUsers]);

    // --- 统计数据计算 ---
    const stats = {
        total: filteredUsers.length,
        active: filteredUsers.filter(u => u.is_active).length,
        teachers: filteredUsers.filter(u => u.role_name === 'role.teacher').length,
        admins: filteredUsers.filter(u => u.role_name === 'role.base.admin').length,
    };

    return (
        <div className="flex h-[calc(100vh-64px)] bg-gray-50">
            {/* --- 左侧: 组织架构树 --- */}
            <OrgTree 
                bases={bases} 
                selectedBaseId={selectedBaseId} 
                onSelect={setSelectedBaseId}
                totalCount={allUsers.length}
            />

            {/* --- 右侧: 内容区 --- */}
            <div className="flex-1 flex flex-col overflow-hidden">
                
                {/* 1. 顶部统计栏 */}
                <div className="bg-white border-b border-gray-200 p-6 grid grid-cols-4 gap-6">
                    <StatItem label="当前列表人数" value={stats.total} icon={<Users size={20} className="text-indigo-600"/>} />
                    <StatItem label="在职状态" value={`${Math.round(stats.active/stats.total*100 || 0)}%`} icon={<ShieldCheck size={20} className="text-green-600"/>} />
                    <StatItem label="分店校长" value={stats.admins} icon={<Briefcase size={20} className="text-blue-600"/>} />
                    <StatItem label="专职教师" value={stats.teachers} icon={<UserPlus size={20} className="text-orange-600"/>} />
                </div>

                {/* 2. 工具栏 */}
                <div className="px-6 py-4 flex justify-between items-center">
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="搜索姓名、手机或邮箱..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        />
                    </div>
                    <button 
                        onClick={() => alert("请使用之前的'新增员工'弹窗逻辑，此处复用")}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm flex items-center gap-2"
                    >
                        <UserPlus size={16} /> 录入新员工
                    </button>
                </div>

                {/* 3. 员工列表表格 */}
                <div className="flex-1 overflow-y-auto px-6 pb-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
                                <tr>
                                    <th className="px-6 py-4">基本信息</th>
                                    <th className="px-6 py-4">职位/角色</th>
                                    <th className="px-6 py-4">归属组织</th>
                                    <th className="px-6 py-4">状态</th>
                                    <th className="px-6 py-4 text-right">管理操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredUsers.map(u => (
                                    <tr key={u.id} className="hover:bg-gray-50/80 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                                                    {u.full_name?.[0] || u.email[0]}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-900">{u.full_name || '未命名'}</div>
                                                    <div className="text-xs text-gray-500">{u.phone_number || u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <RoleBadge role={u.role_name} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-700">{u.base_name || '总部'}</div>
                                            {u.base_id && <div className="text-xs text-gray-400">ID: ...{u.base_id.slice(-4)}</div>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge active={u.is_active} teaching={u.is_teaching_now} />
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {(u.role_name === 'role.teacher' || u.role_name === 'role.base.admin') && (
                                                <button 
                                                    onClick={() => setConfigTeacher({ id: u.id, full_name: u.full_name || u.email })}
                                                    className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
                                                >
                                                    ⚙️ 配置
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filteredUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-10 text-center text-gray-400">
                                            没有找到匹配的员工
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* 弹窗 */}
            {configTeacher && token && (
                <TeacherConfigModal token={token} teacher={configTeacher} onClose={() => setConfigTeacher(null)} />
            )}
        </div>
    );
}

// --- 子组件 ---
function StatItem({ label, value, icon }: any) {
    return (
        <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-gray-50">{icon}</div>
            <div>
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-xs text-gray-500 font-medium">{label}</div>
            </div>
        </div>
    );
}

function RoleBadge({ role }: { role: string | null }) {
    if (role === 'role.tenant.admin') return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">👑 总部管理</span>;
    if (role === 'role.base.admin') return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">🏢 校长</span>;
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">🧑‍🏫 教师</span>;
}

function StatusBadge({ active, teaching }: { active: boolean, teaching?: boolean }) {
    if (!active) return <span className="text-xs text-gray-400">⚫️ 已离职</span>;
    if (teaching) return <span className="text-xs text-red-500 font-bold animate-pulse">🔴 上课中</span>;
    return <span className="text-xs text-green-600">🟢 在职空闲</span>;
}