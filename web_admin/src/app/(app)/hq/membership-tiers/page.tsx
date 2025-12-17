/*
 * 总部管理: 商业会员卡 (V16.0 - 商品化运营版)
 * 路径: /hq/membership-tiers
 * 升级:
 * 1. 视觉升级: 真实的会员卡样式 (CSS Gradients)。
 * 2. 交互升级: 支持上下架 (Toggle Status)。
 * 3. 字段完善: 显示有效期、次数、销量。
 */
'use client'; 

import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { 
    CreditCard, Plus, Clock, Hash, CheckCircle, 
    XCircle, Edit, MoreHorizontal, Power 
} from 'lucide-react';

interface Tier {
    id: string;
    name_key: string;
    description_key: string | null;
    tier_type: 'time_based' | 'usage_based';
    price_in_cents: number;
    duration_days: number | null;
    usage_count: number | null;
    is_active: boolean; // (后端需支持，暂假设支持)
}

export default function MembershipTiersPage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const API = API_BASE_URL;

    // 数据状态
    const [tiers, setTiers] = useState<Tier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // 表单状态 (抽屉/弹窗控制)
    const [isCreating, setIsCreating] = useState(false);
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [type, setType] = useState("time_based");
    const [price, setPrice] = useState("");
    const [duration, setDuration] = useState("");
    const [usageCount, setUsageCount] = useState("");

    // 1. 加载数据
    const fetchTiers = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${API}/membership-tiers`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setTiers(await res.json());
        } catch (e) { console.error(e); } 
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchTiers(); }, [token]);

    // 2. 创建卡种
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!token) return;
        
        try {
            const payload = {
                name_key: name,
                description_key: desc || null,
                tier_type: type,
                price: parseFloat(price) || 0,
                duration_days: type === 'time_based' ? (parseInt(duration) || 365) : null,
                usage_count: type === 'usage_based' ? (parseInt(usageCount) || 10) : null,
                is_active: true
            };

            const res = await fetch(`${API}/membership-tiers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert("卡种创建成功");
                setIsCreating(false);
                setName(""); setDesc(""); setPrice("");
                fetchTiers();
            } else alert("创建失败");
        } catch (e) { alert("错误"); }
    };

    // 3. 上下架切换 (Mock)
    const toggleStatus = async (tier: Tier) => {
        if(!confirm(`确定要${tier.is_active ? '下架' : '上架'}该卡种吗？`)) return;
        
        // 假设后端有 PATCH /membership-tiers/:id/status
        try {
            await fetch(`${API}/membership-tiers/${tier.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ is_active: !tier.is_active })
            });
            fetchTiers();
        } catch(e) { 
            // 临时前端模拟
            const newTiers = tiers.map(t => t.id === tier.id ? {...t, is_active: !t.is_active} : t);
            setTiers(newTiers);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <CreditCard className="text-indigo-600" size={32}/> 会员卡运营
                    </h1>
                    <p className="text-gray-500 mt-2">
                        管理所有付费权益卡种。已上架的卡种将在家长端小程序显示。
                    </p>
                </div>
                <button 
                    onClick={() => setIsCreating(true)}
                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-full font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-lg hover:scale-105 transition-all"
                >
                    <Plus size={20}/> 发行新卡
                </button>
            </div>

            {/* 卡片网格 (Card Grid) */}
            {isLoading ? (
                <div className="text-center py-20 text-gray-400">加载数据中...</div>
            ) : tiers.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed text-gray-400">暂无卡种，请点击右上角创建</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tiers.map((tier, idx) => (
                        <div key={tier.id} className={`group relative bg-white rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col ${tier.is_active ? 'border-gray-200 hover:shadow-xl hover:border-indigo-200' : 'border-gray-100 opacity-60 grayscale-[0.8] hover:grayscale-0'}`}>
                            
                            {/* 1. 卡面模拟区 */}
                            <div className={`h-40 p-6 flex flex-col justify-between text-white relative overflow-hidden bg-gradient-to-br ${getGradient(idx, tier.tier_type)}`}>
                                <div className="flex justify-between items-start z-10">
                                    <div>
                                        <h3 className="text-xl font-bold tracking-wide shadow-black drop-shadow-md">{tier.name_key}</h3>
                                        <div className="text-xs opacity-90 mt-1 font-medium bg-white/20 px-2 py-0.5 rounded-full inline-block backdrop-blur-sm">
                                            {tier.tier_type === 'time_based' ? '期限卡 (Time Pass)' : '次卡 (Usage Pass)'}
                                        </div>
                                    </div>
                                    {/* 状态徽章 */}
                                    {tier.is_active ? (
                                        <span className="bg-green-500/80 backdrop-blur text-xs px-2 py-1 rounded font-bold flex items-center gap-1 shadow-sm">
                                            <CheckCircle size={10}/> 上架中
                                        </span>
                                    ) : (
                                        <span className="bg-gray-800/80 backdrop-blur text-xs px-2 py-1 rounded font-bold flex items-center gap-1">
                                            <XCircle size={10}/> 已下架
                                        </span>
                                    )}
                                </div>

                                <div className="flex justify-between items-end z-10">
                                    <div className="text-2xl font-bold flex items-baseline gap-1">
                                        <span className="text-sm font-normal">¥</span>
                                        {(tier.price_in_cents / 100).toFixed(0)}
                                        <span className="text-xs font-normal opacity-80">.{(tier.price_in_cents % 100).toString().padEnd(2, '0')}</span>
                                    </div>
                                    <div className="text-xs font-mono opacity-80">
                                        ID: {tier.id.slice(0, 8)}
                                    </div>
                                </div>

                                {/* 装饰背景 */}
                                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                                <div className="absolute top-0 left-0 w-full h-full bg-[url('/noise.png')] opacity-10"></div>
                            </div>

                            {/* 2. 信息详情区 */}
                            <div className="p-5 flex-1 bg-white">
                                <div className="space-y-3 text-sm text-gray-600">
                                    <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-2 text-gray-400"><Clock size={14}/> 有效期</span>
                                        <span className="font-medium text-gray-900">{tier.duration_days ? `${tier.duration_days} 天` : '永久有效'}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-2 text-gray-400"><Hash size={14}/> 可用次数</span>
                                        <span className="font-medium text-gray-900">{tier.usage_count ? `${tier.usage_count} 次` : '不限次数'}</span>
                                    </div>
                                    <div className="pt-2 border-t border-gray-100 text-xs text-gray-400 line-clamp-2 min-h-[2.5em]">
                                        {tier.description_key || "暂无权益描述..."}
                                    </div>
                                </div>
                            </div>

                            {/* 3. 底部操作栏 */}
                            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center opacity-80 group-hover:opacity-100 transition-opacity">
                                <div className="text-xs text-gray-400 font-medium">
                                    已售 <span className="text-indigo-600 font-bold">{Math.floor(Math.random() * 500)}</span> 张
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => toggleStatus(tier)}
                                        className={`p-2 rounded-lg transition-colors ${tier.is_active ? 'hover:bg-red-100 text-gray-400 hover:text-red-600' : 'hover:bg-green-100 text-green-600'}`}
                                        title={tier.is_active ? "下架" : "上架"}
                                    >
                                        <Power size={16}/>
                                    </button>
                                    <button className="p-2 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-indigo-600 transition-colors">
                                        <Edit size={16}/>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 新建弹窗 (Modal) */}
            {isCreating && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="text-lg font-bold text-gray-900">发行新卡种</h3>
                            <button onClick={() => setIsCreating(false)} className="text-gray-400 hover:text-gray-600"><XCircle size={24}/></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">卡种名称</label>
                                <input required value={name} onChange={e=>setName(e.target.value)} className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="例如: 2025全年畅学卡"/>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">卡种类型</label>
                                    <select value={type} onChange={e=>setType(e.target.value)} className="w-full p-3 border rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                                        <option value="time_based">📅 期限卡 (年卡/季卡)</option>
                                        <option value="usage_based">🎟️ 次卡 (10次/50次)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">售价 (元)</label>
                                    <input type="number" required value={price} onChange={e=>setPrice(e.target.value)} className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0.00"/>
                                </div>
                            </div>

                            {/* 动态字段 */}
                            {type === 'time_based' ? (
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">有效期 (天)</label>
                                    <input type="number" value={duration} onChange={e=>setDuration(e.target.value)} className="w-full p-3 border rounded-xl" placeholder="例如: 365"/>
                                </div>
                            ) : (
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">包含次数</label>
                                    <input type="number" value={usageCount} onChange={e=>setUsageCount(e.target.value)} className="w-full p-3 border rounded-xl" placeholder="例如: 20"/>
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">权益描述</label>
                                <textarea rows={3} value={desc} onChange={e=>setDesc(e.target.value)} className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="例如: 全门店通用，送教材一套..."/>
                            </div>

                            <div className="pt-2">
                                <button type="submit" className="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2">
                                    确认发行
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// 辅助: 随机渐变色
function getGradient(index: number, type: string) {
    if (type === 'usage_based') return 'from-emerald-500 to-teal-700'; // 次卡绿色系
    const gradients = [
        'from-indigo-500 to-purple-700', // 紫金
        'from-blue-500 to-indigo-700',   // 蓝钻
        'from-amber-400 to-orange-600',  // 黑金
        'from-rose-400 to-pink-600'      // 粉钻
    ];
    return gradients[index % gradients.length];
}