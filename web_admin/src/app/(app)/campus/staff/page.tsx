/*
 * 校区端: 教职工管理 (V13.3 - 网络适配完整版)
 * 路径: /campus/staff
 * 功能:
 * 1. 员工卡片墙: 显示头像、角色、联系方式。
 * 2. 实时状态: 🟢空闲 / 🔴上课中 / ⚫️离职。
 * 3. 技能展示: 显示该老师能教的课程标签。
 * 4. 教学配置: 复用总部的 TeacherConfigModal。
 * 5. 网络适配: 使用 API_BASE_URL。
 */
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { 
    Users, UserPlus, Mail, Phone, BookOpen, 
    Clock, CheckCircle, PauseCircle, Settings 
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/config'; // (★ 引入配置)
// 复用总部定义的配置弹窗
import TeacherConfigModal from '@/app/(app)/tenant/users/TeacherConfigModal';

// --- 类型定义 ---
interface UserDetail {
    id: string;
    email: string;
    full_name: string;
    phone_number: string | null;
    role_name: string | null;
    is_active: boolean;
    initial_password?: string;
    // (V13.1 新增)
    skills?: string;
    is_teaching_now?: boolean;
}

export default function CampusStaffPage() {
    const { data: session } = useSession();
    const token = session?.user?.rawToken;
    const API = API_BASE_URL; // (★ 使用配置中的 URL)

    // --- 状态 ---
    const [users, setUsers] = useState<UserDetail[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // 弹窗与表单
    const [isCreating, setIsCreating] = useState(false);
    const [configTeacher, setConfigTeacher] = useState<{id: string, full_name: string} | null>(null);
    
    // 创建表单数据
    const [email, setEmail] = useState("");
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");

    // --- 1. 数据获取 ---
    const fetchData = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            // 调用通用接口，后端会自动根据 base_id 过滤
            const res = await fetch(`${API}/tenant/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setUsers(await res.json());
        } catch (e) { 
            console.error(e); 
        } finally { 
            setIsLoading(false); 
        }
    };

    useEffect(() => { fetchData(); }, [token]);

    // --- 2. 创建员工 ---
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!token) return;
        try {
            const res = await fetch(`${API}/tenant/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    email, full_name: fullName, phone_number: phone,
                    role_key: "role.teacher", // 校区只能创建普通老师
                    base_id: null // 后端自动填充当前基地
                })
            });

            if (!res.ok) throw new Error("创建失败");
            
            const newUser = await res.json();
            alert(`✅ 教师入职成功！\n\n账号: ${newUser.email}\n初始密码: ${newUser.initial_password}\n\n请务必复制并告知老师！`);
            
            setIsCreating(false);
            setEmail(""); setFullName(""); setPhone("");
            fetchData();
        } catch (e) { alert("创建失败，请检查邮箱是否重复"); }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* 顶部工具栏 */}
            <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Users className="text-indigo-600"/> 教职工管理
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">管理本校区的教师团队，配置排课技能与时间。</p>
                </div>
                <button 
                    onClick={() => setIsCreating(!isCreating)} 
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm font-medium shadow-sm transition-colors"
                >
                    {isCreating ? "取消录入" : <><UserPlus size={16}/> 录入新教师</>}
                </button>
            </div>

            {/* 创建表单 (折叠区域) */}
            {isCreating && (
                <div className="bg-white p-6 rounded-xl shadow-md border-2 border-indigo-50 animate-in slide-in-from-top-4">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <span className="w-1 h-4 bg-indigo-600 rounded-full"></span> 填写新教师信息
                    </h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">姓名 *</label>
                            <input type="text" required value={fullName} onChange={e=>setFullName(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="真实姓名"/>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">登录邮箱 (账号) *</label>
                            <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="teacher@school.com"/>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">联系电话</label>
                            <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="选填"/>
                        </div>
                        <div className="md:col-span-3 flex justify-end pt-2">
                            <button type="submit" className="bg-green-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-green-700 shadow-sm transition-colors">确认入职</button>
                        </div>
                    </form>
                </div>
            )}

            {/* 员工卡片网格 */}
            {isLoading ? (
                <div className="text-center py-20 text-gray-400">加载中...</div>
            ) : users.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed text-gray-400">暂无员工数据</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {users.map(u => (
                        <div key={u.id} className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all overflow-hidden flex flex-col group">
                            
                            {/* Header: 身份与状态 */}
                            <div className="p-5 flex justify-between items-start border-b border-gray-50">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shadow-sm ${u.role_name === 'role.base.admin' ? 'bg-slate-800 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                                        {u.full_name?.[0] || u.email[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                            {u.full_name || '未命名'}
                                            {u.role_name === 'role.base.admin' && <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">校长</span>}
                                        </h4>
                                        
                                        {/* 实时状态指示 */}
                                        <div className="flex items-center gap-1.5 mt-1 text-xs font-medium">
                                            {!u.is_active ? (
                                                <span className="text-gray-400 flex items-center gap-1"><PauseCircle size={12}/> 已离职</span>
                                            ) : u.is_teaching_now ? (
                                                <span className="text-red-500 flex items-center gap-1 animate-pulse"><Clock size={12}/> 上课中</span>
                                            ) : (
                                                <span className="text-green-600 flex items-center gap-1"><CheckCircle size={12}/> 空闲</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Body: 技能标签 */}
                            <div className="p-5 flex-1 bg-gray-50/50">
                                <h5 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
                                    <BookOpen size={12}/> 教学技能
                                </h5>
                                <div className="flex flex-wrap gap-2">
                                    {u.skills ? (
                                        u.skills.split(', ').map((skill, idx) => (
                                            <span key={idx} className="px-2 py-1 bg-white border border-indigo-100 text-indigo-600 text-xs rounded-md shadow-sm">
                                                {skill}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-xs text-gray-400 italic">暂未配置课程</span>
                                    )}
                                </div>
                            </div>

                            {/* Footer: 操作 */}
                            <div className="p-4 border-t border-gray-100 bg-white">
                                <div className="space-y-1 mb-4 text-xs text-gray-500">
                                    <div className="flex items-center gap-2"><Mail size={12}/> {u.email}</div>
                                    <div className="flex items-center gap-2"><Phone size={12}/> {u.phone_number || '-'}</div>
                                </div>
                                
                                {/* 只有教学人员显示配置按钮 */}
                                {(u.role_name === 'role.teacher' || u.role_name === 'role.base.admin') && (
                                    <button 
                                        onClick={() => setConfigTeacher({ id: u.id, full_name: u.full_name || u.email })}
                                        className="w-full py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Settings size={14}/> 技能与排班配置
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 复用弹窗组件 */}
            {configTeacher && token && (
                <TeacherConfigModal 
                    token={token}
                    teacher={configTeacher}
                    onClose={() => { setConfigTeacher(null); fetchData(); }} // 关闭后刷新以更新 UI 状态
                />
            )}
        </div>
    );
}