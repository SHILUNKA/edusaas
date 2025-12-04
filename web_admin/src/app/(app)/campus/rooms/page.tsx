/*
 * 校区端: 教室/场地管理 (V16.0 - 增删改查完整版)
 */
'use client'; 

import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { LayoutGrid, Plus, Trash2, Edit, X, Check, AlertTriangle } from 'lucide-react';

interface Room { id: string; name: string; capacity: number; layout_rows: number; layout_columns: number; }

export default function CampusRoomsPage() {
    const { data: session } = useSession();
    const token = session?.user?.rawToken;
    const API = API_BASE_URL;

    const [rooms, setRooms] = useState<Room[]>([]); 
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRoom, setEditingRoom] = useState<Room | null>(null);

    // Form State
    const [name, setName] = useState("");
    const [rows, setRows] = useState("5");
    const [cols, setCols] = useState("6");

    const fetchRooms = async () => {
        if (!token) return; 
        try {
            const res = await fetch(`${API}/rooms`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setRooms(await res.json());
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchRooms(); }, [token]); 

    // 打开弹窗 (新建 或 编辑)
    const openModal = (room?: Room) => {
        if (room) {
            setEditingRoom(room);
            setName(room.name);
            setRows(room.layout_rows.toString());
            setCols(room.layout_columns.toString());
        } else {
            setEditingRoom(null);
            setName(""); setRows("5"); setCols("6");
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!token) return;

        const payload = {
            base_id: session?.user?.base_id,
            name: name,
            capacity: parseInt(rows) * parseInt(cols),
            layout_rows: parseInt(rows),
            layout_columns: parseInt(cols)
        };

        try {
            let res;
            if (editingRoom) {
                // Update
                res = await fetch(`${API}/rooms/${editingRoom.id}`, { 
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
            } else {
                // Create
                res = await fetch(`${API}/rooms`, { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
            }

            if (!res.ok) throw new Error("Failed");
            alert(editingRoom ? '修改成功!' : '创建成功!');
            setIsModalOpen(false);
            fetchRooms(); 
        } catch (e) { alert("操作失败"); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("⚠️ 确定删除该教室吗？\n如果有未完成的排课，删除将失败。")) return;
        try {
            const res = await fetch(`${API}/rooms/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 409) return alert("❌ 删除失败：该教室还有未结课的排期，请先处理排课。");
            if (!res.ok) throw new Error("Failed");
            alert("已删除");
            fetchRooms();
        } catch (e) { alert("删除失败"); }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <LayoutGrid className="text-indigo-600"/> 教室与场地
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">管理本校区的物理空间资源。</p>
                </div>
                <button onClick={() => openModal()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm font-medium shadow-sm">
                    <Plus size={16}/> 新建教室
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rooms.map(r => (
                    <div key={r.id} className="bg-white p-5 rounded-xl border border-gray-200 hover:shadow-md transition-all group relative">
                        <div className="flex justify-between items-start mb-1">
                            <h3 className="font-bold text-lg text-gray-800">{r.name}</h3>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openModal(r)} className="p-1 text-gray-400 hover:text-indigo-600 bg-gray-50 rounded"><Edit size={14}/></button>
                                <button onClick={() => handleDelete(r.id)} className="p-1 text-gray-400 hover:text-red-600 bg-gray-50 rounded"><Trash2 size={14}/></button>
                            </div>
                        </div>
                        <div className="text-xs text-gray-500 flex gap-3 mb-4">
                            <span>容量: {r.capacity}人</span>
                            <span>布局: {r.layout_rows}行 x {r.layout_columns}列</span>
                        </div>
                        
                        {/* 预览图 */}
                        <div className="grid gap-1 justify-center bg-gray-50 p-2 rounded border border-gray-100 cursor-not-allowed" style={{ gridTemplateColumns: `repeat(${Math.min(r.layout_columns||6, 10)}, 1fr)` }}>
                            {Array.from({ length: Math.min(r.capacity || 0, 20) }).map((_, i) => (
                                <div key={i} className="w-2 h-2 bg-gray-300 rounded-sm"></div>
                            ))}
                            {(r.capacity || 0) > 20 && <span className="text-[8px] text-gray-400">+</span>}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">{editingRoom ? '编辑教室' : '新建教室'}</h3>
                            <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-gray-400"/></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">教室名称</label>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="例如: 301教室" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-medium text-gray-500 mb-1">行数</label><input type="number" value={rows} onChange={e=>setRows(e.target.value)} className="w-full p-2 border rounded-lg" min="1"/></div>
                                <div><label className="block text-xs font-medium text-gray-500 mb-1">列数</label><input type="number" value={cols} onChange={e=>setCols(e.target.value)} className="w-full p-2 border rounded-lg" min="1"/></div>
                            </div>
                            <div className="bg-indigo-50 text-indigo-700 p-2 rounded text-xs text-center">
                                总容量: {parseInt(rows||'0') * parseInt(cols||'0')} 座
                            </div>
                            {editingRoom && (
                                <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                                    <AlertTriangle size={14} className="shrink-0 mt-0.5"/>
                                    <span>注意：修改布局可能导致现有排课的座位显示异常，建议仅在空闲期修改。</span>
                                </div>
                            )}
                            <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 font-medium">
                                {editingRoom ? '保存修改' : '立即创建'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}