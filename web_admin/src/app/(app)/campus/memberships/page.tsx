/*
 * 校区端: 会员中心 (V2.1 - 修复数据丢失版)
 * 路径: /campus/memberships/page.tsx
 * 修复: 找回了学员和会员卡的聚合逻辑，现在卡片上能正确显示学员和余额了。
 */
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
    Users, Search, Filter, Plus, ChevronRight, CreditCard, UserPlus, 
    DollarSign, X, CheckCircle, Loader2, AlertCircle, Baby
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/config';

// --- 1. 接口定义 ---
interface Participant { id: string; name: string; customer_id: string; }

interface MembershipCard {
    id: string;
    customer_id: string;
    tier_id: string;
    remaining_uses: number | null;
    expiry_date: string | null;
    is_active: boolean;
    // 前端辅助字段
    tier_name?: string;
}

interface MembershipTier {
    id: string;
    name_key: string;
    tier_type: 'time_based' | 'usage_based';
    price_in_cents: number;
    duration_days?: number;
    usage_count?: number;
}

interface Customer {
    id: string;
    name: string | null;
    phone_number: string;
    avatar_url: string | null;
    created_at: string;
    // (★ 聚合字段)
    participants?: Participant[]; 
    cards?: MembershipCard[];
}

// ==========================================
// 主页面组件
// ==========================================
export default function MembershipsPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const API = API_BASE_URL;

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // 办卡弹窗状态
    const [purchaseModalCustomer, setPurchaseModalCustomer] = useState<Customer | null>(null);

    // (★ 修复: 完整的数据聚合逻辑)
    const fetchData = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const headers = { 'Authorization': `Bearer ${token}` };
            
            // 1. 并行请求所有相关数据
            const [custRes, partRes, cardRes, tierRes] = await Promise.all([
                fetch(`${API}/customers`, { headers }),
                fetch(`${API}/participants`, { headers }),
                fetch(`${API}/base/customer-memberships`, { headers }),
                fetch(`${API}/membership-tiers`, { headers })
            ]);

            if (custRes.ok && partRes.ok && cardRes.ok && tierRes.ok) {
                const rawCustomers: Customer[] = await custRes.json();
                const rawParticipants: Participant[] = await partRes.json();
                const rawCards: MembershipCard[] = await cardRes.json();
                const tiers: MembershipTier[] = await tierRes.json();

                // 2. 在前端进行数据组装 (Aggregation)
                const mergedCustomers = rawCustomers.map(c => {
                    // A. 关联学员
                    const myParticipants = rawParticipants.filter(p => p.customer_id === c.id);
                    
                    // B. 关联会员卡 (并补全卡种名称)
                    const myCards = rawCards
                        .filter(card => card.customer_id === c.id && card.is_active)
                        .map(card => ({
                            ...card,
                            tier_name: tiers.find(t => t.id === card.tier_id)?.name_key || '未知卡种'
                        }));

                    return {
                        ...c,
                        participants: myParticipants,
                        cards: myCards
                    };
                });

                setCustomers(mergedCustomers);
            }
        } catch (e) { 
            console.error("Failed to fetch membership data", e); 
        } finally { 
            setIsLoading(false); 
        }
    };

    useEffect(() => { if (token) fetchData(); }, [token]);

    // 搜索过滤
    const filteredCustomers = customers.filter(c => 
        c.phone_number.includes(searchTerm) || 
        (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.participants && c.participants.some(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())))
    );

    const handlePurchaseSuccess = () => {
        setPurchaseModalCustomer(null);
        fetchData(); 
        alert("🎉 办理成功！");
    };

    return (
        <div className="p-6 max-w-[1200px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Users className="text-indigo-600" /> 学员与会员中心
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">管理客户档案、学员信息及会员卡办理。</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/campus/participants/new">
                        <button className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm">
                            <UserPlus size={18} /> 新生录入
                        </button>
                    </Link>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="搜索客户姓名、手机号或学员姓名..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                </div>
                <button className="p-2.5 border rounded-lg text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                    <Filter size={18} /> <span className="hidden sm:inline">筛选</span>
                </button>
            </div>

            {/* Grid */}
            {isLoading ? (
                <div className="text-center py-20 text-gray-500 flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" /> 加载数据中...
                </div>
            ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                    <Users size={40} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 font-medium">暂无匹配的客户</p>
                    <p className="text-gray-400 text-sm mt-1">尝试更换搜索词，或点击上方进行新生录入。</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCustomers.map(customer => (
                        <CustomerCard 
                            key={customer.id} 
                            customer={customer} 
                            onOpenPurchaseModal={() => setPurchaseModalCustomer(customer)}
                        />
                    ))}
                </div>
            )}

            {/* Modal */}
            {purchaseModalCustomer && token && (
                <MembershipPurchaseModal 
                    token={token}
                    customer={purchaseModalCustomer}
                    onClose={() => setPurchaseModalCustomer(null)}
                    onSuccess={handlePurchaseSuccess}
                />
            )}
        </div>
    );
}

// ==========================================
// 子组件: 客户卡片
// ==========================================
function CustomerCard({ customer, onOpenPurchaseModal }: { customer: Customer, onOpenPurchaseModal: () => void }) {
    const displayPhone = customer.phone_number.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
    const hasParticipants = customer.participants && customer.participants.length > 0;
    const hasCards = customer.cards && customer.cards.length > 0;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full group">
            {/* Head */}
            <div className="p-5 flex items-start gap-4 border-b border-gray-50">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg shrink-0">
                    {customer.name ? customer.name[0] : 'U'}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                    <h3 className="font-bold text-gray-900 truncate flex items-center gap-2">
                        {customer.name || '未命名客户'}
                    </h3>
                    <p className="text-sm text-gray-500 font-mono mt-0.5 flex items-center gap-1">
                        <Users size={12} className="text-gray-400" /> {displayPhone}
                    </p>
                </div>
                <Link href={`/campus/memberships/${customer.id}`} className="text-gray-300 hover:text-indigo-600 p-1 rounded-full hover:bg-indigo-50 transition-colors opacity-0 group-hover:opacity-100">
                    <ChevronRight size={20} />
                </Link>
            </div>

            {/* Body: 左右分栏 (学员 | 会员卡) */}
            <div className="p-4 flex-1 grid grid-cols-2 gap-4">
                {/* 左: 学员 */}
                <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                        <Baby size={12}/> 学员 ({customer.participants?.length || 0})
                    </h4>
                    {hasParticipants ? (
                        <div className="flex flex-col gap-1.5">
                            {customer.participants!.map(p => (
                                <div key={p.id} className="text-sm font-medium text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-100 truncate">
                                    {p.name}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-300 italic mt-1">暂无学员</p>
                    )}
                </div>

                {/* 右: 会员卡 */}
                <div className="space-y-2 border-l border-gray-100 pl-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                        <CreditCard size={12}/> 会员卡
                    </h4>
                    {hasCards ? (
                        <div className="flex flex-col gap-1.5">
                            {customer.cards!.map(card => (
                                <div key={card.id} className="text-xs bg-yellow-50 text-yellow-800 px-2 py-1.5 rounded border border-yellow-100">
                                    <div className="font-bold truncate" title={card.tier_name}>{card.tier_name}</div>
                                    <div className="mt-0.5 opacity-90">
                                        {card.remaining_uses !== null 
                                            ? `余 ${card.remaining_uses} 次` 
                                            : `至 ${card.expiry_date ? new Date(card.expiry_date).toLocaleDateString() : '-'}`
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-300 italic mt-1">暂无有效卡</p>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="p-3 bg-gray-50 border-t border-gray-100 grid grid-cols-2 gap-2">
                <Link href={`/campus/participants/new?parent=${customer.id}`} className="flex items-center justify-center gap-1 text-xs font-medium text-gray-600 hover:text-indigo-600 hover:bg-white py-2 rounded border border-transparent hover:border-gray-200 transition-all">
                    <Plus size={14} /> 添加学员
                </Link>
                <button 
                     onClick={onOpenPurchaseModal}
                     className="flex items-center justify-center gap-1 text-xs font-medium text-gray-600 hover:text-green-600 hover:bg-white py-2 rounded border border-transparent hover:border-gray-200 transition-all"
                >
                    <DollarSign size={14} /> 办卡充值
                </button>
            </div>
        </div>
    );
}

// ==========================================
// 子组件: 办卡充值弹窗 (保持不变)
// ==========================================
interface PurchaseModalProps {
    token: string;
    customer: Customer;
    onClose: () => void;
    onSuccess: () => void;
}

function MembershipPurchaseModal({ token, customer, onClose, onSuccess }: PurchaseModalProps) {
    const API = API_BASE_URL;
    const [tiers, setTiers] = useState<MembershipTier[]>([]);
    const [loadingTiers, setLoadingTiers] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [selectedTierId, setSelectedTierId] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTiers = async () => {
            try {
                const res = await fetch(`${API}/membership-tiers?active_only=true`, { headers: { 'Authorization': `Bearer ${token}` } });
                if (res.ok) setTiers(await res.json());
            } catch (e) { setError("网络错误"); } 
            finally { setLoadingTiers(false); }
        };
        fetchTiers();
    }, [token, API]);

    const handlePurchase = async (e: FormEvent) => {
        e.preventDefault();
        if (!selectedTierId) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(`${API}/customer-memberships`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ customer_id: customer.id, tier_id: selectedTierId, participant_id: null })
            });
            if (!res.ok) throw new Error("办理失败");
            onSuccess();
        } catch (e: any) { setError(e.message); setSubmitting(false); }
    };

    const selectedTier = tiers.find(t => t.id === selectedTierId);

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 relative">
                <div className="flex justify-between items-center p-5 border-b bg-gray-50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><CreditCard className="text-indigo-600" /> 办卡充值</h3>
                        <p className="text-sm text-gray-500 mt-1">客户: <span className="font-medium text-gray-800">{customer.name || customer.phone_number}</span></p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>
                <div className="p-6">
                    {loadingTiers ? (
                        <div className="py-10 text-center text-gray-500 flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={18} /> 加载中...</div>
                    ) : tiers.length === 0 ? (
                        <div className="py-8 text-center text-gray-500">暂无上架卡种</div>
                    ) : (
                        <form onSubmit={handlePurchase} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">选择会员卡种</label>
                                <select value={selectedTierId} onChange={e => setSelectedTierId(e.target.value)} className="w-full p-3 border rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" required>
                                    <option value="">-- 请选择 --</option>
                                    {tiers.map(tier => <option key={tier.id} value={tier.id}>{tier.name_key} (¥{(tier.price_in_cents / 100).toFixed(2)})</option>)}
                                </select>
                            </div>
                            {selectedTier && (
                                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 space-y-2 text-sm animate-in fade-in slide-in-from-top-2">
                                    <div className="flex justify-between"><span className="text-gray-600">权益:</span><span className="font-medium text-indigo-900">{selectedTier.tier_type === 'time_based' ? `有效期 ${selectedTier.duration_days} 天` : `可用 ${selectedTier.usage_count} 次`}</span></div>
                                    <div className="border-t border-indigo-100 pt-2 flex justify-between items-center mt-2"><span className="text-gray-600 font-bold">应收:</span><span className="text-xl font-bold text-indigo-600">¥{(selectedTier.price_in_cents / 100).toFixed(2)}</span></div>
                                </div>
                            )}
                            <div className="pt-2">
                                <button type="submit" disabled={submitting || !selectedTierId} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                                    {submitting ? <><Loader2 className="animate-spin" /> 处理中...</> : <><CheckCircle /> 确认收款</>}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}