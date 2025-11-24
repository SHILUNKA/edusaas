/*
 * B端后台: 教室 (Rooms) 管理页面
 * 路径: /tenant/rooms
 */
'use client'; 

import { useState, useEffect, FormEvent } from 'react';
import { useAuthStore } from '@/store/authStore';

// --- 1. 定义 TypeScript 类型 ---

// (来自 /api/v1/bases)
interface Base {
    id: string;
    name: string;
}
// (来自 /api/v1/tenant/rooms)
interface Room {
    id: string;
    base_id: string;
    name: string;
    capacity: number | null;
}

// 2. 定义我们的 React 页面组件
export default function RoomsPage() {
    
    // --- 状态管理 ---
    const [rooms, setRooms] = useState<Room[]>([]); // 教室列表
    const [bases, setBases] = useState<Base[]>([]); // (★ 新增) 基地列表
    
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- 表单状态 ---
    const [name, setName] = useState("");
    const [capacity, setCapacity] = useState("");
    const [selectedBaseId, setSelectedBaseId] = useState(""); // (★ 新增) 选中的基地ID
    
    const token = useAuthStore((state) => state.token);
    const API_URL_ROOMS = 'http://localhost:8000/api/v1/tenant/rooms';
    const API_URL_BASES = 'http://localhost:8000/api/v1/bases'; // (★ 新增)

    // --- 核心逻辑 ---

    // 3. 'GET' 数据获取函数
    const fetchData = async () => {
        if (!token) return; 
        setIsLoading(true);
        setError(null);
        try {
            // (★ 关键 ★) 我们现在使用 Promise.all 并行获取 "教室" 和 "基地"
            const [roomsRes, basesRes] = await Promise.all([
                fetch(API_URL_ROOMS, {
                    headers: { 'Authorization': `Bearer ${token}` },
                }),
                fetch(API_URL_BASES, {
                    headers: { 'Authorization': `Bearer ${token}` },
                })
            ]);

            if (!roomsRes.ok) throw new Error(`获取教室失败: ${roomsRes.status}`);
            if (!basesRes.ok) throw new Error(`获取基地失败: ${basesRes.status}`);

            const roomsData: Room[] = await roomsRes.json();
            const basesData: Base[] = await basesRes.json();

            setRooms(roomsData);
            setBases(basesData);
            
            // (★ 关键 ★) 自动将下拉菜单默认选中 "第一个" 基地
            if (basesData.length > 0) {
                setSelectedBaseId(basesData[0].id);
            }

        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    // 4. 页面加载时自动获取数据
    useEffect(() => {
        if (token) {
            fetchData();
        }
    }, [token]); 

    // 5. 'POST' 表单提交函数
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!token || !selectedBaseId) {
            alert("认证失效，或未选择基地");
            return;
        }

        const payload = {
            base_id: selectedBaseId,
            name: name,
            capacity: capacity ? parseInt(capacity, 10) : null,
        };

        try {
            const response = await fetch(API_URL_ROOMS, { // (POST 到 /rooms)
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`, 
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`创建教室失败. Status: ${response.status}`);
            }

            alert('教室创建成功!');
            setName(''); // 清空表单
            setCapacity('');
            
            fetchData(); // (★ 关键 ★) 重新获取 "所有" 数据 (包括新的教室)

        } catch (e) {
            setError((e as Error).message);
            alert(`创建失败: ${(e as Error).message}`);
        }
    };

    // (辅助函数, 用于在列表中显示基地名称)
    const getBaseName = (baseId: string) => {
        return bases.find(b => b.id === baseId)?.name || '未知基地';
    };

    // --- 7. 页面渲染 (JSX) ---
    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">总部管理: 教室/场地</h1>
            
            {/* --- (A) 创建新教室的表单 --- */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h2 className="text-xl font-semibold mb-4">创建新教室</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    
                    {/* (★ 关键 ★) 基地选择下拉菜单 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            归属基地 (分店)
                        </label>
                        <select
                            value={selectedBaseId}
                            onChange={(e) => setSelectedBaseId(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            required
                        >
                            <option value="" disabled>-- 请选择一个基地 --</option>
                            {bases.map(base => (
                                <option key={base.id} value={base.id}>
                                    {base.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                教室名称 (例如: "化学实验室A")
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                容量 (人数) (可选)
                            </label>
                            <input
                                type="number"
                                value={capacity}
                                onChange={(e) => setCapacity(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        创建教室
                    </button>
                </form>
            </div>

            {/* --- (B) 已有教室的列表 --- */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">教室列表 (按基地)</h2>
                {isLoading && <p>正在加载列表...</p>}
                {error && <p className="text-red-500">加载失败: {error}</p>}
                
                {!isLoading && !error && (
                    <ul className="divide-y divide-gray-200">
                        {rooms.length === 0 ? (
                            <p>还没有创建任何教室。</p>
                        ) : (
                            rooms.map(room => (
                                <li key={room.id} className="py-4">
                                    <div className="flex justify-between items-center">
                                        <p className="text-lg font-medium text-indigo-600">{room.name}</p>
                                        <p className="text-sm font-semibold text-gray-700">
                                            {/* (★ 关键 ★) 显示所属基地名称 */}
                                            {getBaseName(room.base_id)}
                                        </p>
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        容量: {room.capacity || 'N/A'} 人
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