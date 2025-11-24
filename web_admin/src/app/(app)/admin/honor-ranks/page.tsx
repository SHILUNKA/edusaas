/*
 * B端后台: 荣誉军衔管理页面
 * 路径: /admin/honor-ranks
 */

// 这是一个交互式页面, 所以我们使用 "use client"
'use client'; 

import { useState, useEffect, FormEvent } from 'react';

// 1. 定义 "军衔" 的 TypeScript 类型
// (这必须与我们的 Rust 'HonorRank' 结构体 100% 匹配)
interface HonorRank {
    id: string; // uuid 在 TypeScript 中就是 string
    tenant_id: string;
    name_key: string;
    rank_level: number;
    points_required: number;
    badge_icon_url: string | null;
}

// 2. 定义我们的 React 页面组件
export default function HonorRanksPage() {
    
    // --- 状态管理 ---
    
    // 列表状态 (用于 'GET' 接口)
    const [ranks, setRanks] = useState<HonorRank[]>([]); // 军衔列表
    const [isLoading, setIsLoading] = useState(true); // 加载状态
    const [error, setError] = useState<string | null>(null); // 错误信息

    // 表单状态 (用于 'POST' 接口)
    const [nameKey, setNameKey] = useState("");
    const [rankLevel, setRankLevel] = useState("0");
    const [points, setPoints] = useState("0");
    const [iconUrl, setIconUrl] = useState("");

    // Rust API 的地址
    const API_URL = 'http://localhost:8000/api/v1/honor-ranks';

    // --- 核心逻辑 ---

    // 3. 'GET' 数据获取函数
    const fetchRanks = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(API_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data: HonorRank[] = await response.json();
            setRanks(data);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    // 4. 页面加载时自动获取数据 (useEffect)
    useEffect(() => {
        fetchRanks();
    }, []); // 空数组 [] 意味着 "只在页面第一次加载时运行"

    // 5. 'POST' 表单提交函数
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault(); // 阻止浏览器默认的表单刷新

        // 准备要发送的 JSON payload
        const payload = {
            name_key: nameKey,
            rank_level: parseInt(rankLevel, 10),
            points_required: parseInt(points, 10),
            badge_icon_url: iconUrl || null
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Failed to create rank. Status: ${response.status}`);
            }

            // 创建成功!
            alert('军衔创建成功!');
            setNameKey(''); // 清空表单
            setRankLevel('0');
            setPoints('0');
            setIconUrl('');
            
            fetchRanks(); // 6. (关键) 自动刷新列表!

        } catch (e) {
            setError((e as Error).message);
            alert(`创建失败: ${(e as Error).message}`);
        }
    };

    // --- 7. 页面渲染 (JSX) ---
    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">总部管理: 荣誉军衔</h1>
            
            {/* --- (A) 创建新军衔的表单 --- */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h2 className="text-xl font-semibold mb-4">创建新军衔</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            名称 (Key) (例如: "rank.level.1.newbie")
                        </label>
                        <input
                            type="text"
                            value={nameKey}
                            onChange={(e) => setNameKey(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            required
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                等级 (例如: 1)
                            </label>
                            <input
                                type="number"
                                value={rankLevel}
                                onChange={(e) => setRankLevel(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                所需积分 (例如: 0)
                            </label>
                            <input
                                type="number"
                                value={points}
                                onChange={(e) => setPoints(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                                required
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            徽章图标 (URL) (可选)
                        </label>
                        <input
                            type="text"
                            value={iconUrl}
                            onChange={(e) => setIconUrl(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        创建
                    </button>
                </form>
            </div>

            {/* --- (B) 已有军衔的列表 --- */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">军衔列表</h2>
                {isLoading && <p>正在加载列表...</p>}
                {error && <p className="text-red-500">加载失败: {error}</p>}
                
                {!isLoading && !error && (
                    <ul className="divide-y divide-gray-200">
                        {ranks.length === 0 ? (
                            <p>还没有创建任何军衔。</p>
                        ) : (
                            ranks.map(rank => (
                                <li key={rank.id} className="py-4 flex justify-between items-center">
                                    <div>
                                        <p className="text-lg font-medium text-indigo-600">{rank.name_key}</p>
                                        <p className="text-sm text-gray-500">
                                            等级: {rank.rank_level} | 所需积分: {rank.points_required}
                                        </p>
                                    </div>
                                    <span className="text-xs text-gray-400">ID: {rank.id.substring(0, 8)}...</span>
                                </li>
                            ))
                        )}
                    </ul>
                )}
            </div>
        </div>
    );
}