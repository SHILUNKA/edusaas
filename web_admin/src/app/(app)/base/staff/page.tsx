/*
 * 校区教职工管理 (V21.3 - 颜色视觉增强版)
 * 路径: web_admin/src/app/(app)/base/staff/page.tsx
 */
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { 
    UserPlus, Filter, Briefcase, GraduationCap, Calculator, ShieldCheck, 
    MoreHorizontal, Mail, Phone, Calendar, Edit3, User
} from 'lucide-react';

// === 1. 定义角色与颜色配置 ===
const CAMPUS_ROLES = [
    // 标准角色
    { key: 'role.base.academic', label: '教务/教师', icon: GraduationCap, color: 'blue', desc: '排课、上课' },
    { key: 'role.base.finance', label: '财务专员', icon: Calculator, color: 'emerald', desc: '收费、报销' }, // emerald 是更像钱的绿色
    { key: 'role.base.hr', label: '行政人事', icon: Briefcase, color: 'orange', desc: '考勤、后勤' },
    { key: 'role.base.admin', label: '校长/主管', icon: ShieldCheck, color: 'purple', desc: '校区管理' },
    
    // ★ 兼容旧数据角色 (灰色)
    { key: 'role.teacher', label: '普通教师(旧)', icon: User, color: 'gray', desc: '请编辑修正角色' },
];

// 辅助函数：解决 Tailwind 动态类名无法被扫描的问题
// 我们显式返回颜色类名，保证生产环境样式不丢失
const getRoleStyle = (color: string) => {
    switch (color) {
        case 'blue': return { bg: 'bg-blue-100', text: 'text-blue-700', iconBg: 'bg-blue-500' };
        case 'emerald': return { bg: 'bg-emerald-100', text: 'text-emerald-700', iconBg: 'bg-emerald-500' };
        case 'orange': return { bg: 'bg-orange-100', text: 'text-orange-700', iconBg: 'bg-orange-500' };
        case 'purple': return { bg: 'bg-purple-100', text: 'text-purple-700', iconBg: 'bg-purple-500' };
        default: return { bg: 'bg-gray-100', text: 'text-gray-600', iconBg: 'bg-gray-400' };
    }
};

interface Staff {
    id: string;
    email: string;
    full_name: string;
    role_name: string;
    phone_number?: string;
    staff_status: 'active' | 'pending' | 'resigned';
    created_at: string;
}

export default function CampusStaffPage() {
    const { data: session } = useSession();
    const token = session?.user?.rawToken;
    const baseId = session?.user?.base_id;

    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterRole, setFilterRole] = useState('all');
    
    // 弹窗状态
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

    // ★ 修复加载逻辑：只要有 Token 就尝试加载，不做 baseId 强校验
    const fetchStaff = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const query = baseId ? `?base_id=${baseId}` : ''; 
            const res = await fetch(`${API_BASE_URL}/hq/users${query}`, { 
                headers: { 'Authorization': `Bearer ${token}` } 
            });
            if (res.ok) setStaffList(await res.json());
        } catch (e) { console.error(e); } 
        finally { setIsLoading(false); }
    };

    useEffect(() => { if(token) fetchStaff(); }, [token, baseId]);

    const filteredList = staffList.filter(u => filterRole === 'all' || u.role_name === filterRole);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Briefcase className="text-indigo-600" size={28}/> 教职工管理
                    </h1>
                    <p className="text-gray-500 mt-1">管理本校区的全职、兼职员工及访问权限。</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <select 
                            value={filterRole} 
                            onChange={e => setFilterRole(e.target.value)}
                            className="appearance-none bg-white border border-gray-200 pl-4 pr-10 py-2.5 rounded-xl text-sm font-bold text-gray-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option value="all">全岗位</option>
                            {CAMPUS_ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                        </select>
                        <Filter className="absolute right-3 top-3 text-gray-400 pointer-events-none" size={16}/>
                    </div>
                    <button onClick={() => setIsCreateOpen(true)} className="bg-black text-white px-5 py-2.5 rounded-xl font-bold hover:bg-gray-800 flex items-center gap-2 shadow-lg hover:scale-105 transition-transform">
                        <UserPlus size={18}/> 新增员工
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredList.map(staff => {
                    // 1. 找到对应的配置
                    const roleConfig = CAMPUS_ROLES.find(r => r.key === staff.role_name) || CAMPUS_ROLES[CAMPUS_ROLES.length - 1]; // 找不到就用最后一个(灰色)
                    const RoleIcon = roleConfig.icon;
                    // 2. 获取颜色样式
                    const styles = getRoleStyle(roleConfig.color);

                    return (
                        <div key={staff.id} className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-indigo-300 transition-colors group relative">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    {/* 头像背景色 */}
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md ${styles.iconBg}`}>
                                        {staff.full_name[0]}
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-900 text-lg">{staff.full_name}</div>
                                        {/* 标签背景色 & 文字色 */}
                                        <div className={`text-xs font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1 mt-1 ${styles.bg} ${styles.text}`}>
                                            <RoleIcon size={12}/> {roleConfig.label}
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setEditingStaff(staff)} className="text-gray-300 hover:text-indigo-600 transition-colors">
                                    <Edit3 size={20}/>
                                </button>
                            </div>

                            <div className="space-y-2 text-sm text-gray-500">
                                <div className="flex items-center gap-2"><Mail size={14} className="text-gray-400"/> {staff.email}</div>
                                <div className="flex items-center gap-2"><Phone size={14} className="text-gray-400"/> {staff.phone_number || '未录入电话'}</div>
                                <div className="flex items-center gap-2"><Calendar size={14} className="text-gray-400"/> {new Date(staff.created_at).toLocaleDateString()} 入职</div>
                            </div>

                            <div className="mt-5 pt-4 border-t border-gray-100 flex justify-between items-center">
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                    staff.staff_status === 'active' ? 'bg-green-100 text-green-700' : 
                                    staff.staff_status === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'
                                }`}>
                                    {staff.staff_status === 'active' ? '● 在职' : staff.staff_status === 'pending' ? '○ 待入职' : '× 已离职'}
                                </span>
                                <button onClick={() => setEditingStaff(staff)} className="text-xs font-bold text-indigo-600 hover:underline">
                                    编辑详情
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal: Create */}
            {isCreateOpen && (
                <StaffModal 
                    token={token} 
                    baseId={baseId} 
                    mode="create"
                    onClose={() => setIsCreateOpen(false)} 
                    onSuccess={fetchStaff} 
                />
            )}

            {/* Modal: Edit */}
            {editingStaff && (
                <StaffModal 
                    token={token} 
                    baseId={baseId} 
                    mode="edit"
                    initialData={editingStaff}
                    onClose={() => setEditingStaff(null)} 
                    onSuccess={fetchStaff} 
                />
            )}
        </div>
    );
}

// === 通用表单组件 (Create & Edit) ===
interface ModalProps {
    token: string;
    baseId: string;
    mode: 'create' | 'edit';
    initialData?: Staff;
    onClose: () => void;
    onSuccess: () => void;
}

function StaffModal({ token, baseId, mode, initialData, onClose, onSuccess }: ModalProps) {
    const [formData, setFormData] = useState({
        email: initialData?.email || '',
        full_name: initialData?.full_name || '',
        role_key: initialData?.role_name || 'role.base.academic',
        phone_number: initialData?.phone_number || '',
        password: Math.random().toString(36).slice(-8) + "!Aa1",
        staff_status: initialData?.staff_status || 'active'
    });

    const isEdit = mode === 'edit';

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        try {
            const url = isEdit 
                ? `${API_BASE_URL}/hq/users/${initialData?.id}` // PUT
                : `${API_BASE_URL}/hq/users`; // POST
            
            const method = isEdit ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    ...formData,
                    base_id: baseId, 
                    password: isEdit ? undefined : formData.password
                })
            });

            if (res.ok) {
                if (!isEdit) alert(`✅ 员工创建成功！\n账号: ${formData.email}\n密码: ${formData.password}`);
                else alert("✅ 修改成功！");
                onSuccess();
                onClose();
            } else {
                alert("操作失败");
            }
        } catch (e) { alert("网络错误"); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <h3 className="text-xl font-bold mb-1">{isEdit ? '编辑员工档案' : '新增校区员工'}</h3>
                <p className="text-sm text-gray-500 mb-6">{isEdit ? '更新员工的岗位、联系方式或状态。' : '为本校区添加新的工作伙伴。'}</p>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* 角色选择 (带颜色的单选框) */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1 uppercase">岗位角色</label>
                        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                            {CAMPUS_ROLES.map(role => {
                                const styles = getRoleStyle(role.color);
                                return (
                                    <label key={role.key} className={`flex items-center gap-3 p-2 border rounded-xl cursor-pointer transition-all ${formData.role_key === role.key ? `border-${role.color}-500 bg-${role.color}-50 ring-1 ring-${role.color}-500` : 'hover:bg-gray-50'}`}>
                                        <input 
                                            type="radio" 
                                            name="role" 
                                            value={role.key} 
                                            checked={formData.role_key === role.key}
                                            onChange={e => setFormData({...formData, role_key: e.target.value})}
                                            className="hidden"
                                        />
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${styles.iconBg} text-white`}>
                                            <role.icon size={14}/>
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-900">{role.label}</div>
                                            <div className="text-xs text-gray-400">{role.desc}</div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1 uppercase">姓名</label>
                            <input required value={formData.full_name} onChange={e=>setFormData({...formData, full_name: e.target.value})} className="w-full p-2.5 border rounded-lg"/>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1 uppercase">状态</label>
                            <select value={formData.staff_status} onChange={e=>setFormData({...formData, staff_status: e.target.value as any})} className="w-full p-2.5 border rounded-lg bg-white">
                                <option value="active">在职</option>
                                <option value="pending">待报到</option>
                                <option value="resigned">离职</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1 uppercase">电话</label>
                        <input value={formData.phone_number} onChange={e=>setFormData({...formData, phone_number: e.target.value})} className="w-full p-2.5 border rounded-lg" placeholder="138..."/>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1 uppercase">登录邮箱</label>
                        <input type="email" required readOnly={isEdit} value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} className={`w-full p-2.5 border rounded-lg ${isEdit ? 'bg-gray-100 text-gray-500' : ''}`} placeholder="name@base.com"/>
                    </div>

                    {!isEdit && (
                        <div className="pt-2">
                            <label className="text-xs font-bold text-gray-500 block mb-1 uppercase">初始密码</label>
                            <div className="p-3 bg-gray-100 rounded-lg font-mono text-center text-gray-600 tracking-widest select-all">
                                {formData.password}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2 justify-end mt-6">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors">取消</button>
                        <button type="submit" className="px-6 py-2.5 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-lg">
                            {isEdit ? '保存修改' : '确认添加'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}