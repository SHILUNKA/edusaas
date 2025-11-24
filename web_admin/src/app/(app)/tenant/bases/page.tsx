/*
 * B端后台: 基地 (分店) 管理页面
 * 路径: /tenant/bases
 */
'use client'; 

import { useState, useEffect, FormEvent } from 'react';
import { useAuthStore } from '@/store/authStore'; // 导入我们的认证 "管家"

// 1. 定义 "基地" 的 TypeScript 类型
// (必须与 Rust 'Base' 结构体匹配)
interface Base {
    id: string;
    tenant_id: string;
    name: string;
    address: string | null;
}

// 2. 定义我们的 React 页面组件
export default function BasesPage() {
    
    // --- 状态管理 ---
    const [bases, setBases] = useState<Base[]>([]); // 基地列表
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 表单状态
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    
    // (关键) 从 "管家" 获取 Token
    const token = useAuthStore((state) => state.token);

    const API_URL = 'http://localhost:8000/api/v1/bases';

    // --- 核心逻辑 ---

    // 3. 'GET' 数据获取函数
    const fetchBases = async () => {
        if (!token) return; // 如果没有 token, 不执行获取

        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(API_URL, {
                method: 'GET',
                headers: {
                    // (关键!) 我们现在必须发送认证 Token
                    'Authorization': `Bearer ${token}`, 
                },
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data: Base[] = await response.json();
            setBases(data);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    // 4. 页面加载时自动获取数据 (useEffect)
    // (注意: 依赖项中加入了 'token')
    useEffect(() => {
        // 只有当我们获得了 token (即登录成功) 后, 才去获取数据
        if (token) {
            fetchBases();
        }
    }, [token]); // 当 token 变化时 (例如从 null -> 'ey...') 触发

    // 5. 'POST' 表单提交函数
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!token) {
            alert("认证失效，请重新登录");
            return;
        }

        const payload = {
            name: name,
            address: address || null
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`, // (关键!) POST 也需要 Token
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`创建基地失败. Status: ${response.status}`);
            }

            alert('基地创建成功!');
            setName(''); // 清空表单
            setAddress('');
            
            fetchBases(); // 自动刷新列表!

        } catch (e) {
            setError((e as Error).message);
            alert(`创建失败: ${(e as Error).message}`);
        }
    };

    // --- 7. 页面渲染 (JSX) ---
    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">总部管理: 基地 (分店)</h1>
            
            {/* --- (A) 创建新基地的表单 --- */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h2 className="text-xl font-semibold mb-4">创建新基地</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            基地名称 (例如: "北京朝阳基地")
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            required
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            基地地址 (可选)
                        </label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        创建基地
                    </button>
                </form>
            </div>

            {/* --- (B) 已有基地的列表 --- */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">基地列表</h2>
                {isLoading && <p>正在加载列表...</p>}
                {error && <p className="text-red-500">加载失败: {error}</p>}
                
                {!isLoading && !error && (
                    <ul className="divide-y divide-gray-200">
                        {bases.length === 0 ? (
                            <p>还没有创建任何基地。</p>
                        ) : (
                            bases.map(base => (
                                <li key={base.id} className="py-4">
                                    <p className="text-lg font-medium text-indigo-600">{base.name}</p>
                                    <p className="text-sm text-gray-500">
                                        地址: {base.address || '未设置'}
                                    </p>
                                    <span className="text-xs text-gray-400">ID: {base.id.substring(0, 8)}...</span>
                                </li>
                            ))
                        )}
                    </ul>
                )}
            </div>
        </div>
    );
}