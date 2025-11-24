/*
 * B端后台: 商业会员卡 (Membership Tiers) 管理页面 (V2 - Next-Auth 升级版)
 * 路径: /tenant/membership-tiers
 * 修复: 移除 useAuthStore, 改为 useSession
 */
'use client'; 

import { useState, useEffect, FormEvent } from 'react';
// (★ 修复) 导入 useSession, 移除 useAuthStore
import { useSession } from 'next-auth/react';
// import { useAuthStore } from '@/store/authStore'; //

// (★ 修复) 确保 console.log 在 'use client' 之后
console.log("✅ (Tenant Tiers) 正在加载: /tenant/membership-tiers/page.tsx (V2)");


// 1. 定义 "会员卡种" 的 TypeScript 类型 (保持不变)
type MembershipTierType = "time_based" | "usage_based";

interface MembershipTier {
    id: string;
    tenant_id: string;
    name_key: string;
    description_key: string | null;
    tier_type: MembershipTierType;
    price_in_cents: number;
    duration_days: number | null;
    usage_count: number | null;
    is_active: boolean;
}

// 2. 定义我们的 React 页面组件
export default function MembershipTiersPage() {
    
    // --- 状态管理 (保持不变) ---
    const [tiers, setTiers] = useState<MembershipTier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- 表单状态 (保持不变) ---
    const [nameKey, setNameKey] = useState("");
    const [descriptionKey, setDescriptionKey] = useState("");
    const [tierType, setTierType] = useState<MembershipTierType>("time_based");
    const [price, setPrice] = useState("0.00");
    const [duration, setDuration] = useState("");
    const [usages, setUsages] = useState("");
    
    // (★ 修复) 从 useSession 获取 token
    const { data: session } = useSession();
    const token = session?.user?.rawToken; //
    // const token = useAuthStore((state) => state.token); //

    // (★ 修复) API_URL 保持不变, 'localhost:8000' 是正确的
    const API_URL = 'http://localhost:8000/api/v1/membership-tiers'; //

    // --- 核心逻辑 ---

    // 3. 'GET' 数据获取函数 (保持不变)
    const fetchTiers = async () => {
        if (!token) return; 

        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(API_URL, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data: MembershipTier[] = await response.json();
            setTiers(data);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    // 4. 页面加载时自动获取数据 (依赖 [token] 仍然有效)
    useEffect(() => {
        if (token) {
            fetchTiers();
        }
    }, [token]); 

    // 5. 'POST' 表单提交函数 (保持不变)
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!token) {
            alert("认证失效，请重新登录");
            return;
        }

        const priceF64 = parseFloat(price);
        if (isNaN(priceF64)) {
            alert("价格必须是一个有效的数字!");
            return;
        }

        // (★ 关键) 确保 payload 匹配 models.rs
        const payload = {
            name_key: nameKey,
            description_key: descriptionKey || null,
            tier_type: tierType,
            price: priceF64, // (Rust 后端期望 f64)
            duration_days: tierType === 'time_based' ? parseInt(duration, 10) : null,
            usage_count: tierType === 'usage_based' ? parseInt(usages, 10) : null,
            is_active: true,
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`, 
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`创建卡种失败. Status: ${response.status}`);
            }

            alert('会员卡种创建成功!');
            setNameKey('');
            setDescriptionKey('');
            setPrice('0.00');
            setDuration('');
            setUsages('');
            
            fetchTiers(); // 自动刷新列表!

        } catch (e) {
            setError((e as Error).message);
            alert(`创建失败: ${(e as Error).message}`);
        }
    };

    // --- 7. 页面渲染 (JSX - 保持不变) ---
    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">总部管理: 商业会员卡</h1>
            
            {/* --- (A) 创建新卡种的表单 --- */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h2 className="text-xl font-semibold mb-4">定义新卡种</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* (表单内容... 保持不变) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            卡种名称 (Key) (例如: "membership.tier.gold_year")
                        </label>
                        <input
                            type="text"
                            value={nameKey}
                            onChange={(e) => setNameKey(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            required
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                卡种类型
                            </label>
                            <select
                                value={tierType}
                                onChange={(e) => setTierType(e.target.value as MembershipTierType)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            >
                                <option value="time_based">计时卡 (例如 年卡/季卡)</option>
                                <option value="usage_based">计次卡 (例如 10次卡)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                价格 (元)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                                required
                            />
                        </div>
                    </div>

                    {tierType === 'time_based' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                有效期 (天) (例如: 365)
                            </label>
                            <input
                                type="number"
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                                placeholder="例如: 365"
                            />
                        </div>
                    )}
                    {tierType === 'usage_based' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                有效次数 (次) (例如: 10)
                            </label>
                            <input
                                type="number"
                                value={usages}
                                onChange={(e) => setUsages(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                                placeholder="例如: 10"
                            />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            描述 (Key) (可选)
                        </label>
                        <input
                            type="text"
                            value={descriptionKey}
                            onChange={(e) => setDescriptionKey(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        创建卡种
                    </button>
                </form>
            </div>

            {/* --- (B) 已有卡种的列表 --- */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">卡种列表</h2>
                {isLoading && <p>正在加载列表...</p>}
                {error && <p className="text-red-500">加载失败: {error}</p>}
                
                {!isLoading && !error && (
                    <ul className="divide-y divide-gray-200">
                        {tiers.length === 0 ? (
                            <p>还没有定义任何卡种。</p>
                        ) : (
                            tiers.map(tier => (
                                <li key={tier.id} className="py-4">
                                    <div className="flex justify-between items-center">
                                        <p className="text-lg font-medium text-indigo-600">{tier.name_key}</p>
                                        <p className="text-xl font-bold text-gray-900">
                                            ¥{(tier.price_in_cents / 100).toFixed(2)}
                                        </p>
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        类型: {tier.tier_type === 'time_based' ? '计时卡' : '计次卡'}
                                        {tier.duration_days && ` (${tier.duration_days} 天)`}
                                        {tier.usage_count && ` (${tier.usage_count} 次)`}
                                    </p>
                                </li>
                            ))
                        )}
                    </ul>
                )}
            </div>
        </div>
    );
}