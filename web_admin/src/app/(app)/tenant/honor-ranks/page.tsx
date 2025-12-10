/*
 * 总部管理: 荣誉军衔体系 (V16.1 - 双轨制激励版)
 * 路径: /admin/honor-ranks
 * 升级: 
 * 1. 引入 "航天" vs "国防" 双体系 Tab。
 * 2. 视觉升级为 "晋升路线图" (Roadmap Style)。
 * 3. 增加勋章图标展示位。
 */
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { 
    Award, Shield, Rocket, Edit, Plus, Star, 
    TrendingUp, Gift, ChevronRight 
} from 'lucide-react';

interface Rank {
    id: string;
    name_key: string;
    rank_level: number;
    points_required: number;
    badge_icon_url?: string;
    // 模拟字段 (未来后端需支持)
    category?: 'aerospace' | 'defense'; 
}

export default function HonorRanksPage() {
    const { data: session } = useSession();
    const token = (session as any)?.user?.rawToken;
    const API = API_BASE_URL;

    const [ranks, setRanks] = useState<Rank[]>([]);
    const [activeTab, setActiveTab] = useState<'defense' | 'aerospace'>('defense');
    const [isLoading, setIsLoading] = useState(true);
    
    // 编辑状态
    const [editingRank, setEditingRank] = useState<Rank | null>(null);
    const [editPoints, setEditPoints] = useState("");

    // 1. 加载数据
    const fetchRanks = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${API}/honor-ranks`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                // 模拟数据拆分 (实际应由后端返回 category)
                // 这里简单演示：假设所有数据都归为当前 Tab，或者写死一些 Mock 数据
                setRanks(data.sort((a:Rank, b:Rank) => a.rank_level - b.rank_level));
            }
        } catch (e) { console.error(e); } 
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchRanks(); }, [token]);

    // 2. 更新积分
    const handleUpdate = async () => {
        if (!editingRank || !token) return;
        try {
            const res = await fetch(`${API}/honor-ranks/${editingRank.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ points_required: parseInt(editPoints) })
            });
            if (res.ok) {
                setEditingRank(null);
                fetchRanks();
            }
        } catch (e) { alert("更新失败"); }
    };

    // 模拟不同体系的配置
    const theme = activeTab === 'defense' 
        ? { color: 'indigo', icon: <Shield size={18}/>, bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' }
        : { color: 'blue', icon: <Rocket size={18}/>, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <Award className="text-amber-500" size={32}/> 成长激励体系
                    </h1>
                    <p className="text-gray-500 mt-2">
                        定义学员的晋升路径。高等级军衔可解锁更多研学权益。
                    </p>
                </div>
                {/* 体系切换 Tab */}
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('defense')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab==='defense' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Shield size={16}/> 国防军事线
                    </button>
                    <button 
                        onClick={() => setActiveTab('aerospace')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab==='aerospace' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Rocket size={16}/> 中国航天线
                    </button>
                </div>
            </div>

            {/* 晋升路线图 (Roadmap) */}
            {isLoading ? (
                <div className="text-center py-20 text-gray-400">加载体系数据...</div>
            ) : (
                <div className="space-y-4">
                    {/* 模拟: 如果是航天线，展示假数据演示效果；如果是国防线，展示真数据 */}
                    {(activeTab === 'defense' ? ranks : mockAerospaceRanks).map((rank, index, arr) => (
                        <div key={rank.id} className="relative pl-8 group">
                            {/* 连接线 */}
                            {index !== arr.length - 1 && (
                                <div className="absolute left-[19px] top-10 bottom-[-16px] w-0.5 bg-gray-200 group-hover:bg-indigo-200 transition-colors"></div>
                            )}
                            
                            <div className={`relative flex items-center justify-between p-5 bg-white border rounded-xl shadow-sm transition-all hover:shadow-md ${editingRank?.id === rank.id ? 'ring-2 ring-indigo-500 border-transparent' : 'border-gray-100 hover:border-indigo-200'}`}>
                                
                                {/* 左侧: 等级与勋章 */}
                                <div className="flex items-center gap-6">
                                    {/* 勋章占位 */}
                                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold border-4 border-white shadow-md z-10 ${theme.bg} ${theme.text}`}>
                                        {/* 只要首字 */}
                                        {rank.name_key[0]}
                                        {/* 这里未来应该放 <img src={rank.badge_url} /> */}
                                        <div className="absolute -bottom-1 -right-1 bg-amber-400 text-white text-[10px] px-1.5 py-0.5 rounded-full border border-white">
                                            Lv.{rank.rank_level}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                            {rank.name_key}
                                            {index === arr.length - 1 && <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">终极目标</span>}
                                        </h3>
                                        <div className="text-sm text-gray-500 mt-1 flex items-center gap-4">
                                            <span className="flex items-center gap-1"><Star size={12} className="text-amber-400"/> 需 {rank.points_required} 积分</span>
                                            {/* 模拟权益 */}
                                            <span className="flex items-center gap-1 text-xs bg-gray-50 px-2 rounded text-gray-400">
                                                <Gift size={10}/> 解锁: {getMockPerk(rank.rank_level)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* 右侧: 操作 */}
                                <div>
                                    {editingRank?.id === rank.id ? (
                                        <div className="flex items-center gap-2 animate-in fade-in">
                                            <input 
                                                type="number" autoFocus
                                                value={editPoints}
                                                onChange={e => setEditPoints(e.target.value)}
                                                className="w-24 p-2 border rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="新积分"
                                            />
                                            <button onClick={handleUpdate} className="bg-indigo-600 text-white px-3 py-2 rounded text-sm hover:bg-indigo-700">保存</button>
                                            <button onClick={() => setEditingRank(null)} className="text-gray-400 px-2 text-sm hover:text-gray-600">取消</button>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => { setEditingRank(rank); setEditPoints(rank.points_required.toString()); }}
                                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                                        >
                                            <Edit size={18}/>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    {/* 底部: 添加新等级按钮 */}
                    <div className="pl-8 pt-4">
                        <button className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-indigo-600 transition-colors border border-dashed border-gray-300 hover:border-indigo-300 rounded-xl px-5 py-3 w-full justify-center">
                            <Plus size={16}/> 规划下一阶段军衔 (即将上线)
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Mock Data ---
const mockAerospaceRanks: Rank[] = [
    { id: 'a1', name_key: '预备队员', rank_level: 1, points_required: 0 },
    { id: 'a2', name_key: '助理工程师', rank_level: 2, points_required: 200 },
    { id: 'a3', name_key: '任务专家', rank_level: 3, points_required: 500 },
    { id: 'a4', name_key: '载荷专家', rank_level: 4, points_required: 1000 },
    { id: 'a5', name_key: '指令长', rank_level: 5, points_required: 2000 },
];

function getMockPerk(level: number) {
    const perks = [
        "无", "专属队徽", "优先选课权", "98折购课权益", 
        "生日专属礼物", "年度研学营邀请", "名人堂展示"
    ];
    return perks[level] || "神秘大奖";
}