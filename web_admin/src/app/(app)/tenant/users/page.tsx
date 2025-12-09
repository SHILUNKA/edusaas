/*
 * B端后台: 员工与权限管理 (V14.1 - 现代化 UI 重构版)
 * 路径: src/app/(app)/tenant/users/page.tsx
 * 优化: 
 * 1. 视觉升级: 卡片式设计，头像增强，角色徽章优化。
 * 2. 交互升级: 折叠式创建表单，释放屏幕空间。
 * 3. 体验升级: 加载骨架屏，空状态提示。
 */
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { 
    Search, UserPlus, Users, Briefcase, ShieldCheck, 
    MapPin, Mail, Phone, MoreHorizontal, X, Check, 
    ChevronRight, Filter 
} from 'lucide-react';
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
    base_id: string | null;
    is_active: boolean;
    is_teaching_now?: boolean;
    skills?: string;
    initial_password?: string; 
}
interface Base { id: string; name: string; }

export default function UsersPage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;

    // 数据状态
    const [allUsers, setAllUsers] = useState<UserDetail[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<UserDetail[]>([]);
    const [bases, setBases] = useState<Base[]>([]);
    
    // 交互状态
    const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreating, setIsCreating] = useState(false); // 控制表单折叠
    const [configTeacher, setConfigTeacher] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    // 表单状态
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [roleKey, setRoleKey] = useState("role.teacher");
    const [selectedBase, setSelectedBase] = useState("");

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

    // --- 筛选逻辑 ---
    useEffect(() => {
        let res = allUsers;
        if (selectedBaseId) res = res.filter(u => u.base_id === selectedBaseId);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            res = res.filter(u => u.full_name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.phone_number?.includes(q));
        }
        setFilteredUsers(res);
    }, [selectedBaseId, searchQuery, allUsers]);

    // --- 提交表单 ---
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!token) return;
        if (roleKey !== 'role.tenant.admin' && !selectedBase) return alert("请选择归属基地");

        try {
            const res = await fetch(`${API_BASE_URL}/tenant/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    email, full_name: fullName, phone_number: phone,
                    role_key: roleKey, base_id: selectedBase 
                })
            });

            if (!res.ok) throw new Error("创建失败");
            
            const newUser = await res.json();
            alert(`✅ 员工创建成功！\n账号: ${newUser.email}\n初始密码: ${newUser.initial_password}`);
            
            // 重置并刷新
            setIsCreating(false);
            setEmail(""); setFullName(""); setPhone(""); setSelectedBase("");
            fetchData();
        } catch (e) { alert("创建失败，请检查邮箱是否重复"); }
    };

    // 统计数据
    const stats = {
        total: filteredUsers.length,
        active: filteredUsers.filter(u => u.is_active).length,
        admins: filteredUsers.filter(u => u.role_name === 'role.base.admin').length,
        teachers: filteredUsers.filter(u => u.role_name === 'role.teacher').length,
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
                
                {/* 1. 顶部统计与操作栏 */}
                <div className="bg-white border-b border-gray-200 px-8 py-6 shadow-sm z-10">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">人员管理中心</h1>
                            <p className="text-sm text-gray-500 mt-1">统一管理全网教职工档案、权限及排课配置。</p>
                        </div>
                        <button 
                            onClick={() => setIsCreating(!isCreating)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all shadow-sm ${isCreating ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md'}`}
                        >
                            {isCreating ? <><X size={18}/> 取消录入</> : <><UserPlus size={18}/> 录入新员工</>}
                        </button>
                    </div>

                    {/* 统计指标 */}
                    <div className="grid grid-cols-4 gap-6">
                        <StatItem label="当前列表人数" value={stats.total} icon={<Users size={20} className="text-indigo-600"/>} bg="bg-indigo-50" />
                        <StatItem label="在职状态" value={`${Math.round(stats.active/stats.total*100 || 0)}%`} icon={<ShieldCheck size={20} className="text-green-600"/>} bg="bg-green-50" />
                        <StatItem label="分店校长" value={stats.admins} icon={<Briefcase size={20} className="text-blue-600"/>} bg="bg-blue-50" />
                        <StatItem label="专职教师" value={stats.teachers} icon={<UserPlus size={20} className="text-orange-600"/>} bg="bg-orange-50" />
                    </div>
                </div>

                {/* 2. 创建表单 (折叠区域) */}
                {isCreating && (
                    <div className="px-8 py-6 bg-indigo-50/30 border-b border-indigo-100 animate-in slide-in-from-top-4">
                        <div className="max-w-5xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <h3 className="text-lg font-bold text-gray-800 mb-5 flex items-center gap-2">
                                <span className="w-1 h-5 bg-indigo-600 rounded-full"></span> 填写新员工档案
                            </h3>
                            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500 uppercase">姓名</label>
                                    <input type="text" required value={fullName} onChange={e=>setFullName(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="真实姓名"/>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500 uppercase">登录邮箱 (账号)</label>
                                    <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="name@company.com"/>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500 uppercase">联系电话</label>
                                    <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="11位手机号"/>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500 uppercase">系统角色</label>
                                    <select value={roleKey} onChange={e=>setRoleKey(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                                        <option value="role.teacher">🧑‍🏫 普通教师</option>
                                        <option value="role.base.admin">🏢 分店校长</option>
                                        <option value="role.tenant.admin">👑 总部管理员</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500 uppercase">归属基地</label>
                                    <select value={selectedBase} onChange={e=>setSelectedBase(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" disabled={roleKey === 'role.tenant.admin'}>
                                        <option value="">-- 请选择 --</option>
                                        {bases.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-1 flex items-end">
                                    <button type="submit" className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95">
                                        <Check size={18} /> 确认创建
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* 3. 列表工具栏 */}
                <div className="px-8 py-4 flex justify-between items-center">
                    <div className="relative w-80">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="搜索姓名、手机或邮箱..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 p-2 border rounded-full text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Filter size={16}/>
                        <span>已筛选 {filteredUsers.length} 人</span>
                    </div>
                </div>

                {/* 4. 员工列表 (卡片式表格) */}
                <div className="flex-1 overflow-y-auto px-8 pb-8">
                    {isLoading ? (
                        <div className="text-center py-20 text-gray-400 flex flex-col items-center">
                            <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-2"></div>
                            加载数据中...
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
                            <Users className="mx-auto text-gray-300 mb-3" size={48}/>
                            <p className="text-gray-500 font-medium">没有找到匹配的员工</p>
                            <p className="text-xs text-gray-400 mt-1">尝试调整筛选条件或录入新员工</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50/50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4 pl-8">员工信息</th>
                                        <th className="px-6 py-4">角色权限</th>
                                        <th className="px-6 py-4">归属组织</th>
                                        <th className="px-6 py-4">状态</th>
                                        <th className="px-6 py-4 text-right pr-8">管理操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredUsers.map(u => (
                                        <tr key={u.id} className="hover:bg-indigo-50/30 transition-colors group">
                                            <td className="px-6 py-4 pl-8">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm ${getAvatarColor(u.full_name)}`}>
                                                        {u.full_name?.[0] || u.email[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-gray-900 text-sm">{u.full_name || '未命名'}</div>
                                                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                            <Mail size={10}/> {u.email}
                                                        </div>
                                                        {u.phone_number && (
                                                            <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                                                <Phone size={10}/> {u.phone_number}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <RoleBadge role={u.role_name} />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 text-sm text-gray-700">
                                                    <MapPin size={14} className="text-gray-400"/>
                                                    {u.base_name || <span className="text-gray-400 italic">总部直属</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusBadge active={u.is_active} teaching={u.is_teaching_now} />
                                            </td>
                                            <td className="px-6 py-4 text-right pr-8">
                                                {(u.role_name === 'role.teacher' || u.role_name === 'role.base.admin') && (
                                                    <button 
                                                        onClick={() => setConfigTeacher({ id: u.id, full_name: u.full_name || u.email })}
                                                        className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm opacity-80 group-hover:opacity-100"
                                                    >
                                                        <span>配置</span>
                                                        <ChevronRight size={12} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
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

function StatItem({ label, value, icon, bg }: any) {
    return (
        <div className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className={`p-3 rounded-lg ${bg}`}>{icon}</div>
            <div>
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</div>
            </div>
        </div>
    );
}

function RoleBadge({ role }: { role: string | null }) {
    if (role === 'role.tenant.admin') return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">👑 总部管理</span>;
    if (role === 'role.base.admin') return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">🏢 校长</span>;
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">🧑‍🏫 教师</span>;
}

function StatusBadge({ active, teaching }: { active: boolean, teaching?: boolean }) {
    if (!active) return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-500"><span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span> 离职</span>;
    if (teaching) return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-600 animate-pulse"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> 上课中</span>;
    return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-600"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> 在职/空闲</span>;
}

// 随机头像颜色生成器
// 随机头像颜色生成器 (修复版)
function getAvatarColor(name: string | null | undefined) {
    const safeName = name || ""; // (★ 修复: 强制转为字符串)
    
    const colors = [
        'bg-red-500', 'bg-orange-500', 'bg-amber-500', 
        'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 
        'bg-cyan-500', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500'
    ];
    const index = safeName.length % colors.length;
    return colors[index];
}