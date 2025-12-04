/*
 * 总部后台: 基地管理 (V14.2 - 现代化卡片视图版)
 * 路径: /tenant/bases
 * 升级: 
 * 1. 采用 Grid 卡片布局，视觉更美观。
 * 2. 增加模拟运营数据指标 (KPIs)，提升管理价值。
 * 3. 新建操作改为弹窗 (Modal)，保持页面整洁。
 */
'use client'; 

import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { 
    Building2, MapPin, Plus, Users, TrendingUp, 
    MoreHorizontal, Edit, Trash2, ArrowRight, X 
} from 'lucide-react';

// --- 类型定义 ---
interface Base {
    id: string;
    tenant_id: string;
    name: string;
    address: string | null;
}

// --- 页面组件 ---
export default function BasesPage() {
    const { data: session } = useSession();
    const token = session?.user?.rawToken;
    const API = API_BASE_URL;

    // 状态
    const [bases, setBases] = useState<Base[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // 表单状态
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // 加载数据
    const fetchBases = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${API}/bases`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (res.ok) {
                setBases(await res.json());
            }
        } catch (e) { console.error(e); } 
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchBases(); }, [token]);

    // 提交新建
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!token) return;
        setSubmitting(true);

        try {
            const res = await fetch(`${API}/bases`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name, address: address || null }),
            });

            if (!res.ok) throw new Error("Failed");
            
            alert('基地创建成功!');
            setName(''); setAddress('');
            setIsModalOpen(false); // 关闭弹窗
            fetchBases();
        } catch (e) { alert("创建失败"); }
        finally { setSubmitting(false); }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* 1. Header: 标题与操作 */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <Building2 className="text-indigo-600" size={32}/> 基地管理
                    </h1>
                    <p className="text-gray-500 mt-2">
                        当前共有 <span className="font-bold text-indigo-600 text-lg">{bases.length}</span> 个运营中的校区。
                        在这里管理您的分支机构网络。
                    </p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-full font-medium hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all hover:scale-105"
                >
                    <Plus size={20}/> 新建基地
                </button>
            </div>

            {/* 2. Content: 基地卡片网格 */}
            {isLoading ? (
                <div className="text-center py-20 text-gray-400">加载数据中...</div>
            ) : bases.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                    <Building2 size={48} className="mx-auto text-gray-300 mb-4"/>
                    <p className="text-gray-500 font-medium">还没有创建任何基地</p>
                    <button onClick={() => setIsModalOpen(true)} className="text-indigo-600 mt-2 hover:underline">立即创建第一个</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {bases.map((base, index) => (
                        <BaseCard key={base.id} base={base} index={index} />
                    ))}
                </div>
            )}

            {/* 3. Modal: 新建弹窗 */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="text-lg font-bold text-gray-900">开设新校区</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">基地名称</label>
                                <input 
                                    type="text" required 
                                    value={name} onChange={e=>setName(e.target.value)}
                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="例如: 北京朝阳示范基地"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">详细地址</label>
                                <input 
                                    type="text" 
                                    value={address} onChange={e=>setAddress(e.target.value)}
                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="例如: 朝阳区科技园A座101"
                                />
                            </div>
                            <div className="pt-2">
                                <button 
                                    type="submit" 
                                    disabled={submitting}
                                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all"
                                >
                                    {submitting ? '正在创建...' : '确认开设'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- 子组件: 基地卡片 (美化版) ---
function BaseCard({ base, index }: { base: Base, index: number }) {
    // 模拟数据 (Mock Data) - 让界面看起来更丰富
    // 实际项目中，这些数据应该通过 API 获取 (例如 /api/v1/bases/:id/stats)
    const mockStats = {
        students: Math.floor(Math.random() * 200) + 50,
        revenue: (Math.random() * 50 + 10).toFixed(1), // 万元
        growth: Math.floor(Math.random() * 20) - 5 // %
    };

    // 随机渐变背景
    const gradients = [
        "from-blue-500 to-cyan-400",
        "from-indigo-500 to-purple-400",
        "from-emerald-500 to-teal-400",
        "from-orange-500 to-amber-400"
    ];
    const bgGradient = gradients[index % gradients.length];

    return (
        <div className="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden">
            {/* 1. 封面区 (带渐变) */}
            <div className={`h-24 bg-gradient-to-r ${bgGradient} p-5 flex justify-between items-start text-white relative`}>
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-2xl">
                    🏢
                </div>
                <button className="p-1.5 bg-white/20 rounded-full hover:bg-white/40 transition-colors">
                    <MoreHorizontal size={18} />
                </button>
                
                {/* 装饰圆圈 */}
                <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
            </div>

            {/* 2. 信息区 */}
            <div className="p-6 pt-4 flex-1 flex flex-col">
                <h3 className="text-xl font-bold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">
                    {base.name}
                </h3>
                <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
                    <MapPin size={14} className="shrink-0"/>
                    <span className="truncate">{base.address || "地址未设置"}</span>
                </div>

                {/* 3. 核心指标 (模拟) */}
                <div className="grid grid-cols-2 gap-4 mb-6 border-t border-b border-gray-50 py-4 bg-gray-50/30 rounded-lg px-2">
                    <div>
                        <div className="text-xs text-gray-400 uppercase font-bold mb-1 flex items-center gap-1">
                            <Users size={12}/> 在读学员
                        </div>
                        <div className="text-lg font-bold text-gray-800">{mockStats.students} 人</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-400 uppercase font-bold mb-1 flex items-center gap-1">
                            <TrendingUp size={12}/> 本月营收
                        </div>
                        <div className="text-lg font-bold text-gray-800">¥ {mockStats.revenue}w</div>
                    </div>
                </div>

                {/* 4. 底部操作 */}
                <div className="mt-auto flex gap-2">
                    <button className="flex-1 bg-gray-50 text-gray-600 py-2 rounded-lg text-xs font-medium hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-center gap-1">
                        <Edit size={14}/> 编辑
                    </button>
                    <button className="flex-1 bg-gray-50 text-gray-600 py-2 rounded-lg text-xs font-medium hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-center gap-1">
                        <ArrowRight size={14}/> 进入管理
                    </button>
                </div>
            </div>
        </div>
    );
}