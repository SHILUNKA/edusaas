/*
 * 总部端: 教室资源总览 (V14.0 - 只读/筛选版)
 * 路径: /hq/rooms
 * 逻辑: 
 * 1. 只能看，不能改。
 * 2. 支持按基地筛选，查看各分店的硬件配置。
 */
'use client'; 

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { MapPin, LayoutGrid, Search, Building2, Filter } from 'lucide-react';

interface Base { id: string; name: string; }
interface Room { id: string; base_id: string; name: string; capacity: number; layout_rows: number; layout_columns: number; }

export default function TenantRoomsPage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const API = API_BASE_URL;

    const [rooms, setRooms] = useState<Room[]>([]); 
    const [bases, setBases] = useState<Base[]>([]); 
    const [isLoading, setIsLoading] = useState(true);

    // 筛选状态
    const [selectedBaseId, setSelectedBaseId] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");

    const fetchData = async () => {
        if (!token) return; 
        try {
            const [roomsRes, basesRes] = await Promise.all([
                // 复用通用接口，总部管理员能拿到所有数据
                fetch(`${API}/hq/rooms`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API}/bases`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            
            if (roomsRes.ok) setRooms(await roomsRes.json());
            if (basesRes.ok) setBases(await basesRes.json());
        } catch (e) { console.error(e); } 
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchData(); }, [token]);

    // 筛选逻辑
    const filteredRooms = rooms.filter(r => {
        const matchBase = selectedBaseId === "all" || r.base_id === selectedBaseId;
        const matchSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchBase && matchSearch;
    });

    // 统计数据
    const totalCapacity = filteredRooms.reduce((acc, r) => acc + (r.capacity || 0), 0);

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <LayoutGrid className="text-indigo-600"/> 教室资源总览
                    </h1>
                    <p className="text-gray-500 mt-2">
                        全网共有 <span className="font-bold text-indigo-600">{rooms.length}</span> 间教室，
                        总承载力 <span className="font-bold text-indigo-600">{rooms.reduce((a,b)=>a+(b.capacity||0),0)}</span> 人次。
                    </p>
                </div>
            </div>

            {/* 筛选栏 */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 min-w-[200px]">
                    <Filter size={16} className="text-gray-500"/>
                    <select 
                        value={selectedBaseId} 
                        onChange={e => setSelectedBaseId(e.target.value)}
                        className="bg-transparent outline-none text-sm font-medium text-gray-700 w-full cursor-pointer"
                    >
                        <option value="all">全部基地</option>
                        {bases.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>

                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="搜索教室名称..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
            </div>

            {/* 列表内容 */}
            {isLoading ? (
                <div className="text-center py-20 text-gray-400">数据加载中...</div>
            ) : filteredRooms.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300 text-gray-500">
                    暂无相关教室数据
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredRooms.map(r => {
                        const baseName = bases.find(b => b.id === r.base_id)?.name || '未知基地';
                        
                        return (
                            <div key={r.id} className="bg-white p-5 rounded-xl border border-gray-200 hover:shadow-md transition-all group">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-800">{r.name}</h3>
                                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                            <Building2 size={12}/> {baseName}
                                        </div>
                                    </div>
                                    <span className="bg-indigo-50 text-indigo-600 text-xs font-bold px-2 py-1 rounded-md">
                                        {r.capacity} 座
                                    </span>
                                </div>
                                
                                {/* 可视化预览 (Mini Map) */}
                                <div className="mt-4">
                                    <div className="flex justify-between text-[10px] text-gray-400 mb-1 uppercase">
                                        <span>Layout</span>
                                        <span>{r.layout_rows} x {r.layout_columns}</span>
                                    </div>
                                    <div 
                                        className="grid gap-1 p-2 bg-gray-50 rounded border border-gray-100"
                                        style={{ gridTemplateColumns: `repeat(${Math.min(r.layout_columns || 6, 10)}, 1fr)` }}
                                    >
                                        {/* 为了性能，只渲染前 20 个格子示意 */}
                                        {Array.from({ length: Math.min((r.capacity || 0), 20) }).map((_, i) => (
                                            <div key={i} className="aspect-square rounded-[2px] bg-gray-300 group-hover:bg-indigo-300 transition-colors"></div>
                                        ))}
                                        {(r.capacity || 0) > 20 && (
                                            <div className="aspect-square flex items-center justify-center text-[8px] text-gray-400">+</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}