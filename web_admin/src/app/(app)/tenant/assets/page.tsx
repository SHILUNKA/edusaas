/*
 * B端后台: 中央资产库 (Asset Types) 管理页面
 * 路径: /tenant/assets
 * 修复: 替换 useAuthStore 为 useSession
 */
'use client'; 

import { useState, useEffect, FormEvent } from 'react';
// 1. 修改导入
import { useSession } from 'next-auth/react';

// 1. 定义 "资产类型" 的 TypeScript 类型
interface AssetType {
    id: string;
    tenant_id: string;
    name_key: string;
    description_key: string | null;
}

// 2. 定义我们的 React 页面组件
export default function AssetTypesPage() {
    
    // --- 状态管理 ---
    const [assetTypes, setAssetTypes] = useState<AssetType[]>([]); 
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 表单状态
    const [nameKey, setNameKey] = useState("");
    const [descriptionKey, setDescriptionKey] = useState("");
    
    // 2. 修改 Token 获取
    const { data: session } = useSession();
    const token = session?.user?.rawToken;

    const API_URL = 'http://localhost:8000/api/v1/asset-types';

    // --- 核心逻辑 ---

    // 3. 'GET' 数据获取函数
    const fetchAssetTypes = async () => {
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
            const data: AssetType[] = await response.json();
            setAssetTypes(data);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    // 4. 页面加载时自动获取数据
    useEffect(() => {
        if (token) {
            fetchAssetTypes();
        }
    }, [token]); 

    // 5. 'POST' 表单提交函数
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!token) {
            alert("认证失效，请重新登录");
            return;
        }

        const payload = {
            name_key: nameKey,
            description_key: descriptionKey || null,
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
                throw new Error(`创建资产类型失败. Status: ${response.status}`);
            }

            alert('资产类型定义创建成功!');
            setNameKey(''); // 清空表单
            setDescriptionKey('');
            
            fetchAssetTypes(); // 自动刷新列表!

        } catch (e) {
            setError((e as Error).message);
            alert(`创建失败: ${(e as Error).message}`);
        }
    };

    // --- 7. 页面渲染 (JSX) ---
    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">总部管理: 中央资产库 (类型)</h1>
            
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h2 className="text-xl font-semibold mb-4">定义新资产类型</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            资产类型 (Key) (例如: "asset.type.vr_goggle")
                        </label>
                        <input
                            type="text"
                            value={nameKey}
                            onChange={(e) => setNameKey(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            required
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            描述 (Key) (可选, 例如: "asset.type.vr_goggle.desc")
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
                        创建资产类型
                    </button>
                </form>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">资产类型列表</h2>
                {isLoading && <p>正在加载列表...</p>}
                {error && <p className="text-red-500">加载失败: {error}</p>}
                
                {!isLoading && !error && (
                    <ul className="divide-y divide-gray-200">
                        {assetTypes.length === 0 ? (
                            <p>还没有定义任何资产类型。</p>
                        ) : (
                            assetTypes.map(at => (
                                <li key={at.id} className="py-4">
                                    <p className="text-lg font-medium text-indigo-600">{at.name_key}</p>
                                    <p className="text-sm text-gray-500">
                                        描述: {at.description_key || 'N/A'}
                                    </p>
                                    <span className="text-xs text-gray-400">ID: {at.id.substring(0, 8)}...</span>
                                </li>
                            ))
                        )}
                    </ul>
                )}
            </div>
        </div>
    );
}