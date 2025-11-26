/* web_admin/src/app/(app)/tenant/rooms/page.tsx */
'use client'; 
import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';

interface Base { id: string; name: string; }
interface Room { id: string; base_id: string; name: string; capacity: number; }

export default function RoomsPage() {
    const [rooms, setRooms] = useState<Room[]>([]); 
    const [bases, setBases] = useState<Base[]>([]); 
    const [isLoading, setIsLoading] = useState(true);
    const [name, setName] = useState("");
    const [rows, setRows] = useState("5");
    const [cols, setCols] = useState("6");
    const [selectedBaseId, setSelectedBaseId] = useState(""); 
    
    const { data: session } = useSession();
    const token = session?.user?.rawToken;
    const API_URL_ROOMS = `${API_BASE_URL}/tenant/rooms`;
    const API_URL_BASES = `${API_BASE_URL}/bases`; 

    const fetchData = async () => {
        if (!token) return; 
        try {
            const [roomsRes, basesRes] = await Promise.all([
                fetch(API_URL_ROOMS, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(API_URL_BASES, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            if (roomsRes.ok) setRooms(await roomsRes.json());
            if (basesRes.ok) {
                const data = await basesRes.json();
                setBases(data);
                if (data.length > 0 && !selectedBaseId) setSelectedBaseId(data[0].id);
            }
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    useEffect(() => { if (token) fetchData(); }, [token]); 

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!token || !selectedBaseId) return;
        const payload = {
            base_id: selectedBaseId, name, capacity: parseInt(rows) * parseInt(cols),
            layout_rows: parseInt(rows), layout_columns: parseInt(cols)
        };
        try {
            const res = await fetch(API_URL_ROOMS, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
            if (!res.ok) throw new Error("Failed");
            alert('教室创建成功!'); setName(''); setRows('5'); setCols('6'); fetchData(); 
        } catch (e) { alert("创建失败"); }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">总部管理: 教室/场地</h1>
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h2 className="text-xl font-semibold mb-4">创建新教室</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div><label className="block text-sm text-gray-700">归属基地</label><select value={selectedBaseId} onChange={(e) => setSelectedBaseId(e.target.value)} className="w-full p-2 border rounded" required>{bases.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                    <div><label className="block text-sm text-gray-700">教室名称</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 border rounded" required /></div>
                    <div className="grid grid-cols-3 gap-4 bg-gray-50 p-3 rounded">
                        <div><label className="block text-xs font-bold text-gray-500">行数</label><input type="number" value={rows} onChange={e=>setRows(e.target.value)} className="w-full p-2 border rounded" min="1"/></div>
                        <div><label className="block text-xs font-bold text-gray-500">列数</label><input type="number" value={cols} onChange={e=>setCols(e.target.value)} className="w-full p-2 border rounded" min="1"/></div>
                        <div className="flex items-end pb-2 text-sm text-gray-500">= 总座席: {parseInt(rows||'0') * parseInt(cols||'0')}</div>
                    </div>
                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">创建教室</button>
                </form>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
                <ul className="divide-y">{rooms.map(r => <li key={r.id} className="py-2 flex justify-between"><span>{r.name} <span className="text-gray-400 text-xs">({bases.find(b=>b.id===r.base_id)?.name})</span></span><span className="text-sm">{r.capacity}座</span></li>)}</ul>
            </div>
        </div>
    );
}