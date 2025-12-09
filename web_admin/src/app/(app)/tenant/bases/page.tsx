/*
 * 总部管理: 基地管理与校长任命 (V17.7 - 随机强密码版)
 * 路径: /tenant/bases
 * 修复: 
 * 1. 解决创建账号时不传密码导致无法登录的问题。
 * 2. 增加随机密码生成器，提升安全性。
 */
'use client'; 

import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { 
    Building2, MapPin, Plus, UserPlus, X, ShieldCheck, 
    RefreshCw, Copy, Check 
} from 'lucide-react';

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

            {/* 弹窗2: 任命校长 (V17.7 升级版) */}
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

// --- 组件: 新建基地 ---
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

// --- 组件: 任命校长 (V17.7 核心升级) ---
function AssignPrincipalModal({ token, base, onClose }: any) {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    
    // 生成随机密码的辅助函数
    const generatePassword = () => {
        const chars = "abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ!@#$";
        let pass = "";
        for (let i = 0; i < 8; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
        return pass;
    };

    const [password, setPassword] = useState(generatePassword());
    const [copied, setCopied] = useState(false);
    const API = API_BASE_URL;

    // 重新生成密码
    const handleRegenerate = () => {
        setPassword(generatePassword());
        setCopied(false);
    };

    // 复制密码
    const handleCopy = () => {
        navigator.clipboard.writeText(password);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API}/tenant/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    email,
                    full_name: name,
                    password: password, // ★★★ V17.7 修复: 显式发送生成的随机密码
                    role_key: 'role.base.admin',
                    base_id: base.id,
                    phone_number: null, gender: null, blood_type: null, date_of_birth: null, address: null
                })
            });

            if (res.ok) {
                alert(`✅ 任命成功！\n请务必将密码发送给校长：\n\n账号: ${email}\n密码: ${password}`);
                onClose();
            } else {
                alert("操作失败：邮箱可能已存在");
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
                    
                    {/* 密码生成区 */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">初始密码 (自动生成)</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input 
                                    readOnly 
                                    value={password} 
                                    className="w-full p-3 border rounded-xl bg-gray-50 font-mono text-gray-800 tracking-wider outline-none"
                                />
                                <button 
                                    type="button"
                                    onClick={handleRegenerate}
                                    className="absolute right-3 top-3 text-gray-400 hover:text-indigo-600 transition-colors"
                                    title="重新生成"
                                >
                                    <RefreshCw size={18}/>
                                </button>
                            </div>
                            <button 
                                type="button"
                                onClick={handleCopy}
                                className={`px-4 rounded-xl border flex items-center gap-1 transition-all ${copied ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 hover:border-indigo-300 text-gray-600'}`}
                            >
                                {copied ? <Check size={18}/> : <Copy size={18}/>}
                                <span className="text-sm font-bold">{copied ? "已复制" : "复制"}</span>
                            </button>
                        </div>
                        <p className="text-xs text-orange-500 mt-2 flex items-center gap-1">
                            * 请复制密码并妥善保管，窗口关闭后无法再次查看。
                        </p>
                    </div>

                    <div className="pt-2">
                        <button type="submit" className="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 flex items-center justify-center gap-2 transition-transform active:scale-95">
                            <ShieldCheck size={18}/> 确认创建账号
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}