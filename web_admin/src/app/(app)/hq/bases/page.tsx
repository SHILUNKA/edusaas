/*
 * 总部管理: 基地管理 (V18.0 - 支持编辑 & 修复代号显示)
 */
'use client'; 

import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { 
    Building2, MapPin, Plus, UserPlus, X, ShieldCheck, 
    RefreshCw, Copy, Check, Pencil 
} from 'lucide-react';

interface Base { id: string; name: string; address: string | null; code?: string; }

export default function TenantBasesPage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const API = API_BASE_URL;

    const [bases, setBases] = useState<Base[]>([]);
    
    // 弹窗状态管理
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBase, setEditingBase] = useState<Base | null>(null); // 如果有值则是编辑模式，null为创建模式
    
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [targetBase, setTargetBase] = useState<Base | null>(null);

    const fetchBases = async () => {
        if (!token) return;
        try {
            const res = await fetch(`${API}/bases`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setBases(await res.json());
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchBases(); }, [token]);

    // 打开创建弹窗
    const handleCreate = () => {
        setEditingBase(null);
        setIsModalOpen(true);
    };

    // 打开编辑弹窗
    const handleEdit = (base: Base) => {
        setEditingBase(base);
        setIsModalOpen(true);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <Building2 className="text-indigo-600" size={32}/> 基地管理
                    </h1>
                    <p className="text-gray-500 mt-2">管理所有分校/基地，设置代号以生成订单。</p>
                </div>
                <button onClick={handleCreate} className="bg-black text-white px-5 py-2.5 rounded-full font-bold hover:bg-gray-800 flex items-center gap-2 shadow-lg transition-transform hover:scale-105">
                    <Plus size={20}/> 新建基地
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bases.map(base => (
                    <div key={base.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow group relative overflow-hidden">
                        
                        {/* 顶部操作区 */}
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-lg">
                                {base.code || <Building2 size={24}/>}
                            </div>
                            <div className="flex gap-2">
                                {/* 编辑按钮 */}
                                <button 
                                    onClick={() => handleEdit(base)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-black transition-colors"
                                    title="编辑信息"
                                >
                                    <Pencil size={14}/>
                                </button>
                                {/* 任命按钮 */}
                                <button 
                                    onClick={() => { setTargetBase(base); setIsAssignOpen(true); }}
                                    className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full font-bold hover:bg-indigo-100 flex items-center gap-1 transition-colors"
                                >
                                    <UserPlus size={14}/> 任命校长
                                </button>
                            </div>
                        </div>

                        <h3 className="text-xl font-bold text-gray-900 mb-2">{base.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500 min-h-[20px]">
                            <MapPin size={16}/>
                            {base.address || "地址未录入"}
                        </div>
                        
                        <div className="mt-6 pt-4 border-t border-gray-50 flex justify-between items-center text-xs text-gray-400">
                            {/* 这里现在应该能正确显示 Code 了 */}
                            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                                CODE: <span className="text-indigo-600 font-bold">{base.code || '---'}</span>
                            </span>
                            <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded">运营中</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* 统一的 基地信息弹窗 (创建/编辑) */}
            {isModalOpen && (
                <BaseInfoModal 
                    token={token} 
                    initialData={editingBase} // 传入初始数据
                    onClose={() => setIsModalOpen(false)} 
                    onSuccess={fetchBases} 
                />
            )}

            {/* 任命校长弹窗 */}
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

// --- 组件: 基地信息弹窗 (合并了创建和编辑) ---
function BaseInfoModal({ token, initialData, onClose, onSuccess }: any) {
    const isEdit = !!initialData;
    const [name, setName] = useState(initialData?.name || "");
    const [addr, setAddr] = useState(initialData?.address || "");
    const [code, setCode] = useState(initialData?.code || ""); 
    const API = API_BASE_URL;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        
        const url = isEdit ? `${API}/bases/${initialData.id}` : `${API}/bases`;
        const method = isEdit ? 'PUT' : 'POST';

        const payload = { 
            name, 
            address: addr,
            code: code.toUpperCase()
        };

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            
            if (res.ok) { 
                alert(isEdit ? "更新成功！" : "创建成功！");
                onSuccess(); 
                onClose(); 
            } else if (res.status === 409) {
                alert("失败：该基地代号已存在，请更换！");
            } else {
                alert("操作失败");
            }
        } catch (error) {
            alert("网络错误");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">{isEdit ? "编辑基地信息" : "新建分校/基地"}</h3>
                    <button onClick={onClose}><X className="text-gray-400 hover:text-gray-600"/></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">基地名称</label>
                        <input required value={name} onChange={e=>setName(e.target.value)} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="例如: 深圳南山旗舰店"/>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                            基地代号 <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-3 items-center">
                            <input 
                                required 
                                maxLength={4}
                                value={code} 
                                onChange={e => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                                className="w-24 p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-lg font-bold tracking-wider uppercase text-center" 
                                placeholder="SZ1"
                            />
                            <div className="flex-1 text-xs text-gray-400 bg-gray-50 p-2 rounded-lg leading-relaxed">
                                订单前缀：<span className="text-indigo-600 font-bold font-mono">RET-{code || 'XXX'}-...</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">详细地址</label>
                        <input value={addr} onChange={e=>setAddr(e.target.value)} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"/>
                    </div>

                    <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 mt-4 shadow-lg shadow-indigo-200 transition-transform active:scale-95">
                        {isEdit ? "保存修改" : "确认创建"}
                    </button>
                </form>
            </div>
        </div>
    );
}

// --- 组件: 任命校长 (保持不变) ---
function AssignPrincipalModal({ token, base, onClose }: any) {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    
    const generatePassword = () => {
        const chars = "abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ!@#$";
        let pass = "";
        for (let i = 0; i < 8; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
        return pass;
    };

    const [password, setPassword] = useState(generatePassword());
    const [copied, setCopied] = useState(false);
    const API = API_BASE_URL;

    const handleRegenerate = () => { setPassword(generatePassword()); setCopied(false); };
    const handleCopy = () => {
        const textArea = document.createElement("textarea");
        textArea.value = password;
        textArea.style.position = "fixed"; textArea.style.left = "-9999px";
        document.body.appendChild(textArea); textArea.select();
        try { document.execCommand('copy'); setCopied(true); } catch (e) { console.error(e); }
        document.body.removeChild(textArea);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API}/hq/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    email, full_name: name, password: password, role_key: 'role.base.admin', base_id: base.id,
                    phone_number: null, gender: null, blood_type: null, date_of_birth: null, address: null
                })
            });

            if (res.ok) {
                alert(`✅ 任命成功！\n请务必将密码发送给校长：\n\n账号: ${email}\n密码: ${password}`);
                onClose();
            } else { alert("操作失败：邮箱可能已存在"); }
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
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">初始密码 (自动生成)</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input readOnly value={password} className="w-full p-3 border rounded-xl bg-gray-50 font-mono text-gray-800 tracking-wider outline-none"/>
                                <button type="button" onClick={handleRegenerate} className="absolute right-3 top-3 text-gray-400 hover:text-indigo-600 transition-colors" title="重新生成"><RefreshCw size={18}/></button>
                            </div>
                            <button type="button" onClick={handleCopy} className={`px-4 rounded-xl border flex items-center gap-1 transition-all ${copied ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 hover:border-indigo-300 text-gray-600'}`}>
                                {copied ? <Check size={18}/> : <Copy size={18}/>}<span className="text-sm font-bold">{copied ? "已复制" : "复制"}</span>
                            </button>
                        </div>
                    </div>
                    <div className="pt-2">
                        <button type="submit" className="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 flex items-center justify-center gap-2 transition-transform active:scale-95"><ShieldCheck size={18}/> 确认创建账号</button>
                    </div>
                </form>
            </div>
        </div>
    );
}