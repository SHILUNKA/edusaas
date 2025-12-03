/*
 * 校区端: 教室/场地管理 (V13.4 - 权限下放版)
 * 路径: /campus/rooms
 */
'use client'; 

import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { LayoutGrid, Plus, Trash2 } from 'lucide-react';

interface Room { id: string; name: string; capacity: number; layout_rows: number; layout_columns: number; }

export default function CampusRoomsPage() {
    const { data: session } = useSession();
    const token = session?.user?.rawToken;
    const API = API_BASE_URL;

    const [rooms, setRooms] = useState<Room[]>([]); 
    const [name, setName] = useState("");
    const [rows, setRows] = useState("5");
    const [cols, setCols] = useState("6");
    const [isCreating, setIsCreating] = useState(false);

    const fetchRooms = async () => {
        if (!token) return; 
        try {
            // 调用通用接口
            const res = await fetch(`${API}/rooms`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setRooms(await res.json());
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchRooms(); }, [token]); 

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!token) return;

        const payload = {
            base_id: session?.user?.base_id, // 虽然后端会校验，但前端传一下也无妨
            name: name,
            capacity: parseInt(rows) * parseInt(cols),
            layout_rows: parseInt(rows),
            layout_columns: parseInt(cols)
        };

        try {
            const res = await fetch(`${API}/rooms`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Failed");
            alert('教室创建成功!');
            setName(''); setIsCreating(false);
            fetchRooms(); 
        } catch (e) { alert("创建失败"); }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <LayoutGrid className="text-indigo-600"/> 教室与场地管理
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">配置本校区的上课教室及其座位布局。</p>
                </div>
                <button onClick={() => setIsCreating(!isCreating)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm font-medium shadow-sm">
                    {isCreating ? "取消" : <><Plus size={16}/> 新建教室</>}
                </button>
            </div>

            {isCreating && (
                <div className="bg-white p-6 rounded-xl shadow-md border-2 border-indigo-50 animate-in slide-in-from-top-4">
                    <h3 className="font-bold text-gray-800 mb-4">📐 新建教室布局</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">教室名称</label>
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="例如: 301教室" required />
                        </div>
                        <div className="grid grid-cols-3 gap-4 bg-gray-50 p-3 rounded-lg">
                            <div><label className="block text-xs font-bold text-gray-500">行数 (排)</label><input type="number" value={rows} onChange={e=>setRows(e.target.value)} className="w-full p-2 border rounded" min="1"/></div>
                            <div><label className="block text-xs font-bold text-gray-500">列数 (座)</label><input type="number" value={cols} onChange={e=>setCols(e.target.value)} className="w-full p-2 border rounded" min="1"/></div>
                            <div className="flex items-end pb-2 text-sm text-gray-500 font-mono">= 总座席: {parseInt(rows||'0') * parseInt(cols||'0')}</div>
                        </div>
                        <div className="flex justify-end">
                            <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700">确认创建</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rooms.map(r => (
                    <div key={r.id} className="bg-white p-5 rounded-xl border border-gray-200 hover:shadow-md transition-all">
                        <h3 className="font-bold text-lg text-gray-800 mb-1">{r.name}</h3>
                        <div className="text-xs text-gray-500 flex gap-3 mb-4">
                            <span>容量: {r.capacity}人</span>
                            <span>布局: {r.layout_rows}x{r.layout_columns}</span>
                        </div>
                        {/* 简单的座位预览图 */}
                        <div className="grid gap-1 justify-center bg-gray-50 p-2 rounded border border-gray-100" style={{ gridTemplateColumns: `repeat(${r.layout_columns}, minmax(0, 1fr))` }}>
                            {Array.from({ length: Math.min(r.capacity || 0, 30) }).map((_, i) => ( // 最多预览30个格子，防止撑爆
                                <div key={i} className="w-2 h-2 bg-gray-300 rounded-sm"></div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}