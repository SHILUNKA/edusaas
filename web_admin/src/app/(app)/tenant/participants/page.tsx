/*
 * B端后台: 总部学员总览 (Participants) 页面
 * 路径: /tenant/participants
 */
'use client'; 

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

// 1. 定义 "学员详情" 的 TypeScript 类型
// (必须与 Rust 'ParticipantDetail' 结构体匹配)
interface ParticipantDetail {
    id: string;
    name: string;
    date_of_birth: string | null; // (日期会作为字符串传来)
    gender: string | null;
    customer_name: string | null;
    customer_phone: string;
    current_total_points: number | null;
    rank_name_key: string | null;
}

// 2. 我们的 React 页面组件
export default function TenantParticipantsPage() {
    
    const [participants, setParticipants] = useState<ParticipantDetail[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const token = useAuthStore((state) => state.token);
    const API_URL = 'http://localhost:8000/api/v1/tenant/participants';

    // 3. 'GET' 数据获取函数
    const fetchParticipants = async () => {
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
            const data: ParticipantDetail[] = await response.json();
            setParticipants(data);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    // 4. 页面加载时自动获取数据
    useEffect(() => {
        if (token) {
            fetchParticipants();
        }
    }, [token]); 

    // 5. 页面渲染 (JSX)
    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">总部 · 学员总览</h1>
            
            {/* --- 学员列表 (使用 "表格" 来展示) --- */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">所有基地的学员</h2>
                {isLoading && <p>正在加载学员列表...</p>}
                {error && <p className="text-red-500">加载失败: {error}</p>}
                
                {!isLoading && !error && (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">学员姓名</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">家长 (手机)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">当前军衔</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">当前积分</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">性别</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {participants.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                                        系统中还没有任何学员数据。
                                    </td>
                                </tr>
                            ) : (
                                participants.map(p => (
                                    <tr key={p.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {p.customer_name || 'N/A'} ({p.customer_phone})
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.rank_name_key || 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.current_total_points ?? 0}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.gender || 'N/A'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}