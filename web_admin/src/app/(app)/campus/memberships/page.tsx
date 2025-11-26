/*
 * 校区端: 学员与会员 CRM (V5.0 - 卡片视图版)
 * 路径: /campus/memberships
 */
'use client';

import { API_BASE_URL } from '@/lib/config';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
    Search, Plus, User, CreditCard, Phone, 
    Baby, Calendar, DollarSign 
} from 'lucide-react';

// --- 接口定义 ---
interface Customer {
    id: string;
    name: string;
    phone_number: string;
    // (前端聚合字段)
    students?: Participant[];
    cards?: MembershipCard[];
}
interface Participant {
    id: string;
    name: string;
    gender: string;
}
interface MembershipCard {
    id: string;
    tier_id: string;
    remaining_uses?: number;
    expiry_date?: string;
    // (为了显示方便，我们需要把 tier 的名字也带过来，这里简化处理，实际最好后端直接返回)
    tier_name?: string; 
}
interface MembershipTier {
    id: string;
    name_key: string;
    tier_type: 'time_based' | 'usage_based';
}

export default function CRMMemberPage() {
    const { data: session } = useSession();
    const token = session?.user?.rawToken;

    // --- 数据源 ---
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [tiers, setTiers] = useState<MembershipTier[]>([]);
    
    // --- 视图状态 ---
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    // --- 模态框状态 (简化版，实际开发建议拆分组件) ---
    const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
    
    // 1. 初始化数据加载
    const fetchData = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const headers = { 'Authorization': `Bearer ${token}` };

            // 并行获取: 家长、学员、会员卡、卡种定义
            const [custRes, partRes, cardsRes, tiersRes] = await Promise.all([
                fetch(`${API_BASE_URL}/customers`, { headers }),
                fetch(`${API_BASE_URL}/participants`, { headers }),
                fetch(`${API_BASE_URL}/base/customer-memberships`, { headers }),
                fetch(`${API_BASE_URL}/membership-tiers`, { headers })
            ]);

            if (custRes.ok && partRes.ok && cardsRes.ok && tiersRes.ok) {
                const rawCust = await custRes.json();
                const rawPart: any[] = await partRes.json();
                const rawCards: any[] = await cardsRes.json();
                const rawTiers: MembershipTier[] = await tiersRes.json();

                setTiers(rawTiers);

                // (★ 核心: 数据聚合逻辑)
                // 将学员和卡片挂载到家长对象上
                const mergedCustomers = rawCust.map((c: any) => ({
                    ...c,
                    students: rawPart.filter(p => p.customer_id === c.id),
                    cards: rawCards.filter(card => card.customer_id === c.id).map(card => ({
                        ...card,
                        tier_name: rawTiers.find(t => t.id === card.tier_id)?.name_key || '未知卡种'
                    }))
                }));

                setCustomers(mergedCustomers);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [token]);

    // 2. 过滤逻辑
    const filteredCustomers = customers.filter(c => 
        c.name?.includes(searchTerm) || c.phone_number.includes(searchTerm)
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* 顶部工具栏 */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    👥 会员中心 <span className="text-sm font-normal text-gray-400">({customers.length}位)</span>
                </h1>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="搜索姓名或手机号..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    {/* 这里为了简化，先做个简单的跳转或弹窗占位 */}
                    <button 
                        onClick={() => window.location.href = '/campus/participants/new'}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-sm"
                    >
                        <Plus size={18} /> 新录入
                    </button>
                </div>
            </div>

            {/* 客户卡片网格 */}
            {isLoading ? (
                <div className="text-center py-20 text-gray-400">加载会员数据中...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredCustomers.map(customer => (
                        <CustomerCard key={customer.id} customer={customer} />
                    ))}
                </div>
            )}
            
            {filteredCustomers.length === 0 && !isLoading && (
                <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <p className="text-gray-500">未找到匹配的会员</p>
                </div>
            )}
        </div>
    );
}

// --- 子组件: 客户卡片 ---
function CustomerCard({ customer }: { customer: Customer }) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
            {/* 卡片头部: 家长信息 */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                        {customer.name?.[0] || 'G'}
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900">{customer.name || '未命名家长'}</h3>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                            <Phone size={12} /> {customer.phone_number}
                        </div>
                    </div>
                </div>
                <span className="px-2 py-1 bg-white border rounded text-xs text-gray-400">
                    ID: {customer.id.slice(0,4)}
                </span>
            </div>

            {/* 卡片主体: 左右布局 (学员 | 会员卡) */}
            <div className="p-4 flex-1 space-y-4">
                
                {/* 左侧: 学员列表 */}
                <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
                        <Baby size={14}/> 关联学员
                    </h4>
                    {customer.students && customer.students.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {customer.students.map(s => (
                                <span key={s.id} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-sm rounded-md border border-blue-100 flex items-center gap-1">
                                    {s.name}
                                    {/* 这里可以加个小红点表示"今日有课" (需额外API支持) */}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-400 italic">暂无学员信息</p>
                    )}
                </div>

                <div className="border-t border-gray-100 my-2"></div>

                {/* 右侧: 会员卡列表 */}
                <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
                        <CreditCard size={14}/> 会员卡资产
                    </h4>
                    {customer.cards && customer.cards.length > 0 ? (
                        <div className="space-y-2">
                            {customer.cards.map(card => (
                                <div key={card.id} className="flex justify-between items-center text-sm p-2 bg-yellow-50 rounded border border-yellow-100 text-yellow-900">
                                    <span className="font-medium truncate max-w-[120px]" title={card.tier_name}>{card.tier_name}</span>
                                    {card.remaining_uses !== null ? (
                                        <span className="font-bold">剩 {card.remaining_uses} 次</span>
                                    ) : (
                                        <span className="text-xs">有效期至 {card.expiry_date ? new Date(card.expiry_date).toLocaleDateString() : '-'}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-400 italic">暂无有效会员卡</p>
                    )}
                </div>
            </div>

            {/* 卡片底部: 操作栏 */}
            <div className="p-3 bg-gray-50 border-t border-gray-100 grid grid-cols-2 gap-2">
                {/* 这里可以使用 Link 跳转到特定的操作页面，并带上 customerId 参数 */}
                <button 
                     onClick={() => alert("功能开发中: 弹窗添加学员")}
                     className="flex items-center justify-center gap-1 text-xs font-medium text-gray-600 hover:text-indigo-600 hover:bg-white py-2 rounded border border-transparent hover:border-gray-200 transition-all"
                >
                    <Plus size={14} /> 添加学员
                </button>
                <button 
                     onClick={() => alert("功能开发中: 弹窗办理办卡")}
                     className="flex items-center justify-center gap-1 text-xs font-medium text-gray-600 hover:text-green-600 hover:bg-white py-2 rounded border border-transparent hover:border-gray-200 transition-all"
                >
                    <DollarSign size={14} /> 办理办卡
                </button>
            </div>
        </div>
    );
}