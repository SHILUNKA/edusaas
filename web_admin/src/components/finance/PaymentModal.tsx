'use client';

import { useState, useRef, useEffect } from 'react'; // ★ 引入 useEffect
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { Order } from './SalesOrderPage';
import { 
    X, UploadCloud, CreditCard, Loader2, 
    FileText, ExternalLink, RefreshCw, Eye
} from 'lucide-react'; 

interface Props {
    order: Order | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function PaymentModal({ order, isOpen, onClose, onSuccess }: Props) {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState({
        amount: '',
        payer_name: '',
        channel: 'bank_transfer',
        proof_url: '', 
    });

    // ★ 新增：每次打开弹窗时，重置表单，防止状态残留
    useEffect(() => {
        if (isOpen) {
            setForm({
                amount: '',
                payer_name: '',
                channel: 'bank_transfer',
                proof_url: '', 
            });
            setUploading(false);
            setSubmitting(false);
        }
    }, [isOpen]);

    // URL 拼接逻辑
    const getFullUrl = (path: string) => {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        const baseUrl = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
        const safePath = path.startsWith('/') ? path : `/${path}`;
        return `${baseUrl}${safePath}`;
    };

    const isPdf = (url: string) => url?.toLowerCase().endsWith('.pdf');
    const getFileName = (url: string) => url?.split('/').pop() || 'unknown_file';

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            alert("文件大小不能超过 10MB");
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${API_BASE_URL}/upload`, { 
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                setForm(prev => ({ ...prev, proof_url: data.url }));
            } else {
                alert("上传失败");
            }
        } catch (err) {
            console.error(err);
            alert("上传出错");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemoveFile = (e: React.MouseEvent) => {
        e.stopPropagation();
        setForm(prev => ({ ...prev, proof_url: '' }));
    };

    const handleSubmit = async () => {
        if (!order || !form.amount) return;
        setSubmitting(true);

        try {
            const res = await fetch(`${API_BASE_URL}/finance/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    order_id: order.id,
                    amount: Number(form.amount),
                    channel: form.channel,
                    payer_name: form.payer_name,
                    proof_url: form.proof_url
                })
            });

            if (res.ok) {
                alert('凭证已提交，请等待财务审核');
                onSuccess();
                onClose();
            } else {
                alert('提交失败: ' + await res.text());
            }
        } catch (e) { console.error(e); } 
        finally { setSubmitting(false); }
    };

    if (!isOpen || !order) return null;
    
    const remaining = (order.total_amount_cents - order.paid_amount_cents) / 100;
    const fullProofUrl = getFullUrl(form.proof_url);
    
    // ★ 调试逻辑：明确计算是否禁用，并生成提示语
    const isDisabled = submitting || !form.amount || !form.payer_name || !form.proof_url || uploading;
    const debugTitle = isDisabled ? 
        `不可点击原因: ${!form.amount ? '[缺金额] ' : ''}${!form.payer_name ? '[缺户名] ' : ''}${!form.proof_url ? '[缺凭证] ' : ''}${uploading ? '[正在上传] ' : ''}` 
        : "点击提交";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-emerald-600 p-6 text-white text-center relative">
                   <button onClick={onClose} className="absolute right-4 top-4 text-emerald-100 hover:text-white"><X size={20}/></button>
                   <div className="mx-auto w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3">
                        <CreditCard size={24}/>
                   </div>
                   <h3 className="text-xl font-bold">录入收款</h3>
                   <p className="text-emerald-100 text-sm mt-1">剩余待付: ¥{remaining.toLocaleString()}</p>
                </div>

                <div className="p-6 space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">本次实收金额 <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <span className="absolute left-3 top-3 text-gray-400 font-bold">¥</span>
                            <input type="number" className="w-full pl-8 p-3 border-2 border-emerald-100 rounded-xl focus:border-emerald-500 outline-none font-bold text-lg text-gray-900"
                                placeholder={remaining.toString()}
                                value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">付款方户名 <span className="text-red-500">*</span></label>
                        <input type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                            placeholder="例如：张三 / 腾讯科技"
                            value={form.payer_name} onChange={e => setForm({...form, payer_name: e.target.value})}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">转账凭证 <span className="text-red-500">*</span></label>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf" onChange={handleFileChange} />

                        <div 
                            className={`relative border-2 border-dashed rounded-xl transition-all overflow-hidden
                                ${form.proof_url 
                                    ? 'border-emerald-500 bg-emerald-50/30' 
                                    : 'border-gray-300 hover:border-emerald-400 hover:bg-gray-50 cursor-pointer p-6'
                                }`}
                            onClick={() => !form.proof_url && fileInputRef.current?.click()}
                        >
                            {uploading ? (
                                <div className="flex flex-col items-center justify-center py-4 text-emerald-600">
                                    <Loader2 className="animate-spin mb-2" size={24}/>
                                    <span className="text-xs font-bold">正在上传...</span>
                                </div>
                            ) : form.proof_url ? (
                                <div className="relative group">
                                    <button 
                                        onClick={handleRemoveFile}
                                        className="absolute top-2 right-2 z-20 p-1.5 bg-white text-red-500 rounded-full shadow-sm hover:bg-red-50 transition-colors"
                                        title="删除凭证"
                                    >
                                        <X size={14}/>
                                    </button>

                                    {isPdf(form.proof_url) ? (
                                        <div className="flex items-center gap-3 p-4 bg-white border border-emerald-100 rounded-xl">
                                            <div className="w-10 h-10 bg-red-50 text-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <FileText size={20}/>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-gray-900 truncate">{getFileName(form.proof_url)}</p>
                                                <a href={fullProofUrl} target="_blank" rel="noreferrer" 
                                                   className="text-xs text-emerald-600 hover:underline flex items-center gap-1 mt-0.5">
                                                   <ExternalLink size={10}/> 点击预览 PDF
                                                </a>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative h-40 w-full bg-gray-100 group">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={fullProofUrl} alt="Proof" className="w-full h-full object-contain"/>
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                                                <button onClick={(e) => { e.stopPropagation(); window.open(fullProofUrl, '_blank'); }} 
                                                    className="p-2 bg-white/90 rounded-full text-gray-700 hover:text-indigo-600 shadow-sm" title="查看大图">
                                                    <Eye size={18}/>
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} 
                                                    className="p-2 bg-white/90 rounded-full text-gray-700 hover:text-emerald-600 shadow-sm" title="更换图片">
                                                    <RefreshCw size={18}/>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-gray-400">
                                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <UploadCloud size={24} className="text-gray-400 group-hover:text-emerald-500"/>
                                    </div>
                                    <span className="text-sm font-bold text-gray-600 group-hover:text-emerald-600">点击上传凭证</span>
                                    <span className="text-[10px] mt-1 text-gray-400">支持 JPG, PNG, PDF (Max 10MB)</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ★ 重点：将 title 设置为调试信息，鼠标悬停即可看到原因 */}
                    <button onClick={handleSubmit} disabled={isDisabled} title={debugTitle}
                        className="w-full py-3.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-200 mt-2">
                        {submitting ? '提交中...' : '确认收款'}
                    </button>
                </div>
            </div>
        </div>
    );
}