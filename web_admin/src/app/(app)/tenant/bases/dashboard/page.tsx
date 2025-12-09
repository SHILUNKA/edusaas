/*
 * 总部管理: 基地管理与校长任命 (V17.6)
 * 路径: /tenant/bases
 */
'use client'; 

import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { Building2, MapPin, Plus, UserPlus, X, ShieldCheck } from 'lucide-react';

interface Base { id: string; name: string; address: string | null; }

export default function TenantBasesPage() {
    const { data: session } = useSession();
    const token = session?.user?.rawToken;
    const API = API_BASE_URL;

    const [bases, setBases] = useState<Base[]>([]);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    
    // 校长任命弹窗状态
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [targetBase, setTargetBase] = useState<Base | null>(null);

    // 加载基地
    const fetchBases = async () => {
        if (!token) return;
        try {
            const res = await fetch(`${API}/bases`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setBases(await res.json());
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchBases(); }, [token]);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <Building2 className="text-indigo-600" size={32}/> 基地管理
                    </h1>
                    <p className="text-gray-500 mt-2">管理所有分校/基地，并任命各校区负责人（校长）。</p>
                </div>
                <button onClick={() => setIsCreateOpen(true)} className="bg-black text-white px-5 py-2.5 rounded-full font-bold hover:bg-gray-800 flex items-center gap-2 shadow-lg transition-transform hover:scale-105">
                    <Plus size={20}/> 新建基地
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bases.map(base => (
                    <div key={base.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow group relative overflow-hidden">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                                <Building2 size={24}/>
                            </div>
                            {/* 任命按钮 */}
                            <button 
                                onClick={() => { setTargetBase(base); setIsAssignOpen(true); }}
                                className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full font-bold hover:bg-indigo-100 flex items-center gap-1 transition-colors"
                            >
                                <UserPlus size={14}/> 任命校长
                            </button>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{base.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <MapPin size={16}/>
                            {base.address || "地址未录入"}
                        </div>
                        
                        <div className="mt-6 pt-4 border-t border-gray-50 flex justify-between items-center text-xs text-gray-400">
                            <span>ID: {base.id.slice(0,8)}...</span>
                            <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded">运营中</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* 弹窗1: 新建基地 */}
            {isCreateOpen && <CreateBaseModal token={token} onClose={() => setIsCreateOpen(false)} onSuccess={fetchBases} />}

            {/* 弹窗2: (★ 新增) 任命校长 */}
            {isAssignOpen && targetBase && (
                <AssignPrincipalModal 
                    token={token} 
                    base={targetBase} 
                    onClose={() => setIsAssignOpen(false)} 
                />
            )}
        </div>
    );
}

// --- 组件: 新建基地 (保持原样，略做美化) ---
function CreateBaseModal({ token, onClose, onSuccess }: any) {
    const [name, setName] = useState("");
    const [addr, setAddr] = useState("");
    const API = API_BASE_URL;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const res = await fetch(`${API}/bases`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name, address: addr })
        });
        if (res.ok) { onSuccess(); onClose(); } else alert("创建失败");
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">新建分校/基地</h3>
                    <button onClick={onClose}><X className="text-gray-400 hover:text-gray-600"/></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">基地名称</label>
                        <input required value={name} onChange={e=>setName(e.target.value)} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="例如: 深圳南山旗舰店"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">详细地址</label>
                        <input value={addr} onChange={e=>setAddr(e.target.value)} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"/>
                    </div>
                    <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 mt-4">确认创建</button>
                </form>
            </div>
        </div>
    );
}

// --- 组件: 任命校长 (★ 核心新增) ---
function AssignPrincipalModal({ token, base, onClose }: any) {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("123456");
    const API = API_BASE_URL;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        try {
            // 调用创建用户接口，并强制指定角色和基地ID
            const res = await fetch(`${API}/tenant/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    email,
                    full_name: name,
                    phone_number: null,
                    gender: null, blood_type: null, date_of_birth: null, address: null,
                    // ★ 关键点: 指定角色为校长，指定基地ID
                    role_key: 'role.base.admin',
                    base_id: base.id
                })
            });

            if (res.ok) {
                alert(`✅ 成功任命 [${name}] 为 [${base.name}] 校长！\n默认密码: 123456`);
                onClose();
            } else {
                alert("操作失败，邮箱可能已存在或权限不足");
            }
        } catch (e) { alert("网络错误"); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl border-t-4 border-indigo-600">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-bold text-gray-900">任命校长</h3>
                    <button onClick={onClose}><X className="text-gray-400 hover:text-gray-600"/></button>
                </div>
                <p className="text-sm text-gray-500 mb-6">
                    正在为 <span className="font-bold text-indigo-600">{base.name}</span> 创建管理员账号。
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">登录邮箱 (账号)</label>
                        <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="例如: principal@sz.com"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">校长姓名</label>
                        <input required value={name} onChange={e=>setName(e.target.value)} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="例如: 王校长"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">初始密码</label>
                        <input disabled value={password} className="w-full p-3 border rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"/>
                        <p className="text-xs text-gray-400 mt-1">* 默认密码为 123456，登录后建议修改</p>
                    </div>

                    <div className="pt-2">
                        <button type="submit" className="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 flex items-center justify-center gap-2">
                            <ShieldCheck size={18}/> 确认授权
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}