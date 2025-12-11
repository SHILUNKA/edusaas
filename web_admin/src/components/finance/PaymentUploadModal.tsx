/*
 * 新建订单弹窗 (零依赖版)
 * 路径: web_admin/components/finance/PaymentUploadModal.tsx
 * 修复: 移除了对 shadcn/ui 的依赖，直接使用 Tailwind CSS 实现 Modal
 */
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { UploadCloud, X, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/lib/config';

interface Props {
    orderId: string;
    // 增加 onClose 属性，方便在外部调用时关闭弹窗（虽然组件内部也可以关闭）
    onClose?: () => void; 
    onSuccess: () => void;
}

export function PaymentUploadModal({ orderId, onClose, onSuccess }: Props) {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // 表单状态
    const [amount, setAmount] = useState('');
    const [payerName, setPayerName] = useState('');
    const [proofUrl, setProofUrl] = useState(''); 

    // 打开/关闭处理
    const handleOpen = () => setIsOpen(true);
    const handleClose = () => {
        setIsOpen(false);
        if (onClose) onClose();
    };

    // 模拟文件上传
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        // TODO: 真实场景请调用您的 OSS 上传接口
        console.log("模拟上传中...");
        // 模拟一个网络延迟
        setTimeout(() => {
            setProofUrl("https://via.placeholder.com/800x600.png?text=Bank+Receipt");
        }, 1000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!proofUrl) {
            alert("请先上传凭证图片");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/finance/payments/offline-proof`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({
                    order_id: orderId,
                    amount: parseFloat(amount), // 前端输入元
                    payer_name: payerName,
                    proof_url: proofUrl
                })
            });

            if (res.ok) {
                alert("凭证提交成功！请等待财务审核。");
                handleClose();
                onSuccess();
            } else {
                alert("提交失败，请重试");
            }
        } catch (err) {
            console.error(err);
            alert("网络错误");
        } finally {
            setLoading(false);
        }
    };

    // 如果弹窗没打开，显示触发按钮
    if (!isOpen) {
        return (
            <button 
                onClick={handleOpen}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-white border border-indigo-200 rounded hover:bg-indigo-50 transition-colors"
            >
                <UploadCloud size={16} /> 上传凭证
            </button>
        );
    }

    // 弹窗打开时的遮罩和内容
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            {/* Modal Content */}
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-lg font-bold text-gray-900">上传线下转账凭证</h3>
                    <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    
                    {/* 付款方 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">付款方户名/备注 (必填)</label>
                        <input 
                            type="text" 
                            required
                            placeholder="例如: xx实验小学 / 张三" 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            value={payerName}
                            onChange={e => setPayerName(e.target.value)}
                        />
                    </div>

                    {/* 金额 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">转账金额 (元)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">¥</span>
                            <input 
                                type="number" 
                                step="0.01"
                                required
                                placeholder="0.00" 
                                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono text-lg font-bold text-indigo-600"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* 图片上传区域 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">凭证截图</label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-indigo-400 transition-colors cursor-pointer bg-gray-50 hover:bg-white relative">
                            <div className="space-y-1 text-center">
                                {proofUrl ? (
                                    <div className="relative">
                                        <p className="text-sm text-green-600 font-medium">✅ 图片已选择</p>
                                        <p className="text-xs text-gray-400 mt-1">点击重新上传</p>
                                    </div>
                                ) : (
                                    <>
                                        <UploadCloud className="mx-auto h-10 w-10 text-gray-400" />
                                        <div className="flex text-sm text-gray-600 justify-center">
                                            <span className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500">
                                                点击上传
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
                                    </>
                                )}
                                <input 
                                    type="file" 
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-2">
                        <button 
                            type="button" 
                            onClick={handleClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            取消
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                        >
                            {loading && <Loader2 size={16} className="animate-spin" />}
                            {loading ? '提交中...' : '确认提交'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}