'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { 
    QrCode, Loader2, CheckCircle, AlertCircle, 
    Database, Download, FileSpreadsheet, ShieldCheck 
} from 'lucide-react';

export default function QrCodeGeneratorPage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;

    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');

    const [form, setForm] = useState({
        batch_name: `批次-${new Date().toISOString().split('T')[0]}`,
        quantity: 1000 // 默认生成 1000 个
    });

    // 1. 处理生成
    const handleGenerate = async () => {
        if (!token) {
            setError("未检测到登录状态，请刷新页面");
            return;
        }
        if (form.quantity > 50000) {
            setError("单次生成建议不超过 50,000 个");
            return;
        }

        setLoading(true);
        setError('');
        setResult(null);

        try {
            const res = await fetch(`${API_BASE_URL}/hq/qrcodes/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(form)
            });

            if (res.ok) {
                const data = await res.json();
                setResult(data);
            } else {
                const txt = await res.text();
                setError(`生成失败: ${txt}`);
            }
        } catch (err: any) {
            console.error(err);
            setError("网络请求出错: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    // 2. 处理下载 CSV
    const handleDownload = async () => {
        if (!result?.batch_id || !token) return;
        
        setDownloading(true);
        try {
            const url = `${API_BASE_URL}/admin/qrcodes/${result.batch_id}/export`;
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("下载失败");

            // 将响应转换为 Blob 并触发下载
            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `Batch_${result.batch_no}.csv`; // 设置文件名
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (e: any) {
            alert("导出失败: " + e.message);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            {/* 页面头部 */}
            <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
                    <ShieldCheck size={32} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">防伪溯源控制台</h1>
                    <p className="text-gray-500 mt-1">生成加密防伪码 -> 导出数据给印刷厂 -> 激活生效</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 左侧：生成控制面板 */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-fit">
                    <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
                        <Database size={20} className="text-indigo-600"/>
                        <h2 className="font-bold text-lg text-gray-800">新建赋码任务</h2>
                    </div>
                    
                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">批次名称 (备注)</label>
                            <input 
                                type="text" 
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
                                value={form.batch_name}
                                onChange={e => setForm({...form, batch_name: e.target.value})}
                                placeholder="例如：2025春季限定盲盒"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">生成数量</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none font-mono text-lg"
                                    value={form.quantity}
                                    onChange={e => setForm({...form, quantity: parseInt(e.target.value) || 0})}
                                />
                                <div className="absolute right-4 top-3.5 text-xs font-bold text-gray-400">PCS</div>
                            </div>
                            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                <AlertCircle size={12}/> 系统限制单次最大 50,000 个，耗时约 0.5秒
                            </p>
                        </div>

                        <button 
                            onClick={handleGenerate}
                            disabled={loading || form.quantity <= 0}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-lg shadow-indigo-100 mt-2"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <QrCode size={20} />}
                            {loading ? 'Rust 引擎正在计算...' : '立即生成'}
                        </button>

                        {error && (
                            <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl flex items-start gap-2 animate-in slide-in-from-top-2">
                                <AlertCircle size={18} className="mt-0.5 shrink-0"/>
                                <span className="break-all font-medium">{error}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 右侧：结果与导出 */}
                <div className={`relative p-6 rounded-2xl border-2 transition-all min-h-[400px] flex flex-col
                    ${result ? 'bg-white border-green-100 shadow-sm' : 'bg-gray-50 border-gray-200 border-dashed'}`}>
                    
                    <div className="flex items-center gap-2 mb-6">
                        <FileSpreadsheet size={20} className={result ? "text-green-600" : "text-gray-400"}/>
                        <h2 className="font-bold text-lg text-gray-800">任务结果</h2>
                    </div>

                    {result ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-300">
                            <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-6 ring-8 ring-green-50/50">
                                <CheckCircle size={40} />
                            </div>
                            
                            <h3 className="text-2xl font-bold text-gray-900">生成成功！</h3>
                            <p className="text-gray-500 mt-2 font-medium">{result.message}</p>
                            
                            <div className="mt-8 w-full bg-gray-50 p-5 rounded-xl border border-gray-100 text-left space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 font-medium">系统批次号</span>
                                    <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{result.batch_no}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 font-medium">批次 ID</span>
                                    <span className="font-mono text-xs text-gray-400 truncate max-w-[150px]" title={result.batch_id}>{result.batch_id}</span>
                                </div>
                                <div className="pt-3 border-t border-gray-200 mt-3">
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        * 数据已写入加密数据库。<br/>
                                        * 请下载 CSV 文件发送给印刷厂。文件中包含 <strong>完整二维码链接</strong> 和 <strong>明文短码</strong>。
                                    </p>
                                </div>
                            </div>

                            <button 
                                onClick={handleDownload}
                                disabled={downloading}
                                className="mt-6 w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-100 flex items-center justify-center gap-2 transition-all"
                            >
                                {downloading ? <Loader2 className="animate-spin"/> : <Download size={20}/>}
                                {downloading ? '正在打包 CSV...' : '下载数据文件 (.csv)'}
                            </button>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
                            <QrCode size={64} className="mb-4 opacity-20"/>
                            <p className="font-medium">等待执行任务</p>
                            <p className="text-sm mt-1">结果将在此处显示</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}