'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { 
    ClipboardList, 
    ArrowDownCircle, 
    ArrowUpCircle, 
    Search,
    Calendar,
    Loader2
} from 'lucide-react';

interface InventoryLog {
    id: string;
    product_name: string;
    sku: string | null;
    image_url: string | null;
    change_amount: number;
    reason: string;
    created_at: string;
}

export default function InventoryRequestsPage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;

    const [logs, setLogs] = useState<InventoryLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (token) fetchLogs();
    }, [token]);

    const fetchLogs = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/base/inventory/logs`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setLogs(await res.json());
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const filteredLogs = logs.filter(log => 
        log.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.reason.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-indigo-600"/></div>;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <ClipboardList className="text-indigo-600" /> 库存变动记录
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        查看物资领用、消耗及入库的历史流水。
                    </p>
                </div>
                <div className="w-64 bg-white p-2 rounded-lg border flex items-center shadow-sm">
                    <Search className="text-gray-400 mr-2" size={18}/>
                    <input 
                        type="text" 
                        placeholder="搜索物资 / 原因..." 
                        className="w-full outline-none text-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b text-gray-500">
                        <tr>
                            <th className="p-4">变动时间</th>
                            <th className="p-4">物资名称</th>
                            <th className="p-4">变动类型/数量</th>
                            <th className="p-4">备注/原因</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {filteredLogs.map(log => {
                            const isIn = log.change_amount > 0;
                            return (
                                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 text-gray-500 font-mono text-xs whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={14}/>
                                            {new Date(log.created_at).toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-gray-100 rounded overflow-hidden shrink-0">
                                                {log.image_url && <img src={log.image_url} className="w-full h-full object-cover"/>}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900">{log.product_name}</div>
                                                <div className="text-xs text-gray-400 font-mono">{log.sku}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${isIn ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                            {isIn ? <ArrowUpCircle size={14}/> : <ArrowDownCircle size={14}/>}
                                            {isIn ? '入库' : '出库'} 
                                            <span className="text-base ml-1">{Math.abs(log.change_amount)}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-gray-700 font-medium">{log.reason}</span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {filteredLogs.length === 0 && (
                    <div className="p-12 text-center text-gray-400">
                        暂无相关记录
                    </div>
                )}
            </div>
        </div>
    );
}