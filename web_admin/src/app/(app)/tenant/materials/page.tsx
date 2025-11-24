/*
 * B端后台: 中央物料库 (Materials) 管理页面
 * 路径: /tenant/materials
 */
'use client'; 

import { useState, useEffect, FormEvent } from 'react';
import { useAuthStore } from '@/store/authStore'; // 导入我们的认证 "管家"

// 1. 定义 "物料" 的 TypeScript 类型
// (必须与 Rust 'Material' 结构体匹配)
interface Material {
    id: string;
    tenant_id: string;
    name_key: string;
    description_key: string | null;
    sku: string | null;
    unit_of_measure: string | null;
}

// 2. 定义我们的 React 页面组件
export default function MaterialsPage() {
    
    // --- 状态管理 ---
    const [materials, setMaterials] = useState<Material[]>([]); // 物料列表
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 表单状态
    const [nameKey, setNameKey] = useState("");
    const [descriptionKey, setDescriptionKey] = useState("");
    const [sku, setSku] = useState("");
    const [unit, setUnit] = useState("");
    
    const token = useAuthStore((state) => state.token);
    const API_URL = 'http://localhost:8000/api/v1/materials';

    // --- 核心逻辑 ---

    // 3. 'GET' 数据获取函数
    const fetchMaterials = async () => {
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
            const data: Material[] = await response.json();
            setMaterials(data);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    // 4. 页面加载时自动获取数据
    useEffect(() => {
        if (token) {
            fetchMaterials();
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
            sku: sku || null,
            unit_of_measure: unit || null,
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
                throw new Error(`创建物料失败. Status: ${response.status}`);
            }

            alert('物料定义创建成功!');
            setNameKey(''); // 清空表单
            setDescriptionKey('');
            setSku('');
            setUnit('');
            
            fetchMaterials(); // 自动刷新列表!

        } catch (e) {
            setError((e as Error).message);
            alert(`创建失败: ${(e as Error).message}`);
        }
    };

    // --- 7. 页面渲染 (JSX) ---
    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">总部管理: 中央物料库</h1>
            
            {/* --- (A) 创建新物料的表单 --- */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h2 className="text-xl font-semibold mb-4">定义新物料</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            物料名称 (Key) (例如: "material.rocket_kit.basic")
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
                                计量单位 (例如: 套)
                            </label>
                            <input
                                type="text"
                                value={unit}
                                onChange={(e) => setUnit(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                SKU (可选)
                            </label>
                            <input
                                type="text"
                                value={sku}
                                onChange={(e) => setSku(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            描述 (Key) (可选, 例如: "material.rocket_kit.basic.desc")
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
                        创建物料
                    </button>
                </form>
            </div>

            {/* --- (B) 已有物料的列表 --- */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">物料列表</h2>
                {isLoading && <p>正在加载列表...</p>}
                {error && <p className="text-red-500">加载失败: {error}</p>}
                
                {!isLoading && !error && (
                    <ul className="divide-y divide-gray-200">
                        {materials.length === 0 ? (
                            <p>还没有定义任何物料。</p>
                        ) : (
                            materials.map(mat => (
                                <li key={mat.id} className="py-4">
                                    <p className="text-lg font-medium text-indigo-600">{mat.name_key}</p>
                                    <p className="text-sm text-gray-500">
                                        SKU: {mat.sku || 'N/A'} | 单位: {mat.unit_of_measure || 'N/A'}
                                    </p>
                                    <span className="text-xs text-gray-400">ID: {mat.id.substring(0, 8)}...</span>
                                </li>
                            ))
                        )}
                    </ul>
                )}
            </div>
        </div>
    );
}