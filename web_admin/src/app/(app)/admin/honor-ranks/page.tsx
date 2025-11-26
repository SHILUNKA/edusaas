/*
 * B端后台: 荣誉军衔管理 (V2.0 - 积分调整版)
 * 路径: /admin/honor-ranks
 */
'use client'; 

import { API_BASE_URL } from '@/lib/config';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface HonorRank {
    id: string;
    name_key: string;
    rank_level: number;
    points_required: number;
}

export default function HonorRanksPage() {
    const { data: session } = useSession();
    const token = session?.user?.rawToken;

    const [ranks, setRanks] = useState<HonorRank[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // 编辑状态
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editPoints, setEditPoints] = useState<number>(0);

    // 获取列表
    const fetchRanks = async () => {
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE_URL}/honor-ranks`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setRanks(await res.json());
        } catch (e) { console.error(e); } 
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchRanks(); }, [token]);

    // 开始编辑
    const handleEditClick = (rank: HonorRank) => {
        setEditingId(rank.id);
        setEditPoints(rank.points_required);
    };

    // 保存修改
    const handleSave = async (id: string) => {
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE_URL}/honor-ranks/${id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ points_required: editPoints })
            });

            if (!res.ok) throw new Error("Update failed");
            
            alert("积分规则已更新");
            setEditingId(null);
            fetchRanks(); // 刷新列表
        } catch (e) {
            alert("更新失败，请重试");
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">荣誉军衔体系</h1>
                <div className="text-sm text-gray-500">
                    * 仅支持调整晋升所需积分，等级结构由系统预设
                </div>
            </div>
            
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-4 font-semibold text-gray-600">等级</th>
                            <th className="p-4 font-semibold text-gray-600">军衔名称</th>
                            <th className="p-4 font-semibold text-gray-600">晋升所需积分</th>
                            <th className="p-4 font-semibold text-gray-600">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {ranks.map((rank) => (
                            <tr key={rank.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4">
                                    <span className="inline-block w-8 h-8 text-center leading-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm">
                                        Lv.{rank.rank_level}
                                    </span>
                                </td>
                                <td className="p-4 font-medium text-gray-900 text-lg">
                                    {rank.name_key}
                                </td>
                                <td className="p-4">
                                    {editingId === rank.id ? (
                                        <input 
                                            type="number" 
                                            value={editPoints}
                                            onChange={(e) => setEditPoints(parseInt(e.target.value) || 0)}
                                            className="border p-1 rounded w-24 text-right"
                                            autoFocus
                                        />
                                    ) : (
                                        <span className="font-mono text-gray-600">{rank.points_required} 分</span>
                                    )}
                                </td>
                                <td className="p-4">
                                    {editingId === rank.id ? (
                                        <div className="space-x-2">
                                            <button 
                                                onClick={() => handleSave(rank.id)}
                                                className="text-green-600 hover:text-green-800 font-medium"
                                            >
                                                保存
                                            </button>
                                            <button 
                                                onClick={() => setEditingId(null)}
                                                className="text-gray-500 hover:text-gray-700"
                                            >
                                                取消
                                            </button>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => handleEditClick(rank)}
                                            className="text-indigo-600 hover:text-indigo-800 font-medium"
                                        >
                                            调整积分
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {ranks.length === 0 && !isLoading && (
                            <tr><td colSpan={4} className="p-8 text-center text-gray-500">暂无军衔数据，请先进行初始化。</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}