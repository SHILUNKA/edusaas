'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { 
    Package, Truck, Download, ShieldCheck, 
    Loader2, AlertCircle, BarChart3, Search 
} from 'lucide-react';

interface Batch {
    id: string;
    batch_no: string;
    name: string;
    quantity: number;
    created_at: string;
    active_count: number;
    scan_count: number;
}

export default function QrBatchManagePage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;

    const [batches, setBatches] = useState<Batch[]>([]);
    const [loading, setLoading] = useState(true);
    const [activatingId, setActivatingId] = useState<string | null>(null);

    // 获取列表
    const fetchBatches = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/admin/qrcodes/batches`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setBatches(await res.json());
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchBatches();
    }, [token]);

    // 处理激活/发货
    const handleActivate = async (batch: Batch) => {
        const confirmMsg = `⚠️ 确认发货操作 \n\n批次：${batch.batch_no}\n数量：${batch.quantity}\n\n激活后，消费者扫码将显示“正品认证”。\n确定要激活吗？`;
        if (!confirm(confirmMsg)) return;

        setActivatingId(batch.id);
        try {
            const res = await fetch(`${API_BASE_URL}/admin/qrcodes/${batch.id}/activate`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                alert(data.message);
                fetchBatches(); // 刷新数据
            } else {
                alert("激活失败，请查看日志");
            }
        } catch (e) {
            alert("网络错误");
        } finally {
            setActivatingId(null);
        }
    };

    // 处理下载
    const handleDownload = (batchId: string, batchNo: string) => {
        const url = `${API_BASE_URL}/admin/qrcodes/${batchId}/export`;
        fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Batch_${batchNo}.csv`;
            a.click();
        });
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                        <Package size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">防伪批次管理</h1>
                        <p className="text-gray-500 text-sm">管理印刷批次状态，执行发货激活操作</p>
                    </div>
                </div>
                <button onClick={fetchBatches} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50">
                    刷新列表
                </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-400">
                        <Loader2 className="animate-spin inline mr-2"/> 加载数据中...
                    </div>
                ) : batches.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">暂无数据，请先去生成防伪码</div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-medium">
                            <tr>
                                <th className="p-4 pl-6">批次号 / 备注</th>
                                <th className="p-4">创建时间</th>
                                <th className="p-4 text-center">总数量</th>
                                <th className="p-4 text-center">状态 (激活/核销)</th>
                                <th className="p-4 text-right pr-6">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {batches.map(batch => {
                                // 简单的状态判断
                                const isFullyActive = batch.active_count >= batch.quantity;
                                const isActive = batch.active_count > 0;

                                return (
                                    <tr key={batch.id} className="hover:bg-gray-50/50">
                                        <td className="p-4 pl-6">
                                            <div className="font-bold text-gray-900 font-mono">{batch.batch_no}</div>
                                            <div className="text-xs text-gray-500 mt-1">{batch.name}</div>
                                        </td>
                                        <td className="p-4 text-gray-500">
                                            {new Date(batch.created_at).toLocaleDateString()}
                                            <div className="text-xs">{new Date(batch.created_at).toLocaleTimeString()}</div>
                                        </td>
                                        <td className="p-4 text-center font-mono">
                                            {batch.quantity.toLocaleString()}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col items-center gap-1">
                                                {/* 进度条 */}
                                                <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-green-500" style={{width: `${(batch.active_count / batch.quantity) * 100}%`}}></div>
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    激活: {batch.active_count} | 核销: {batch.scan_count}
                                                </div>
                                                {!isActive && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                                        未出库 (休眠中)
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right pr-6 space-x-2">
                                            <button 
                                                onClick={() => handleDownload(batch.id, batch.batch_no)}
                                                className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                                                title="下载 CSV"
                                            >
                                                <Download size={14}/>
                                            </button>
                                            
                                            {!isFullyActive ? (
                                                <button 
                                                    onClick={() => handleActivate(batch)}
                                                    disabled={!!activatingId}
                                                    className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm disabled:opacity-50 inline-flex items-center gap-1"
                                                >
                                                    {activatingId === batch.id ? <Loader2 size={14} className="animate-spin"/> : <Truck size={14}/>}
                                                    发货激活
                                                </button>
                                            ) : (
                                                <span className="px-3 py-1.5 text-xs font-bold text-green-600 bg-green-50 rounded-lg border border-green-100 inline-flex items-center gap-1">
                                                    <ShieldCheck size={14}/> 已激活
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}