'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { 
    CheckCircle, XCircle, FileText, Loader2, 
    ExternalLink, User, Building2, AlertCircle 
} from 'lucide-react';

interface AuditRecord {
    id: string;
    amount_cents: number;
    type: string;
    channel: string;
    status: string;
    created_at: string;
    payer_name: string;
    proof_url: string;
    sales_name: string; // 后端新加的
    order: {
        order_no: string;
        customer: string;
    };
}

export default function FinanceAuditPage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    
    const [records, setRecords] = useState<AuditRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // 获取待审核列表
    const fetchRecords = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/finance/payments?status=PENDING`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setRecords(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchRecords();
    }, [token]);

    // 核心修复：处理 verify 动作
    const handleVerify = async (id: string) => {
        if (!confirm('确认该笔款项已到账，并核销订单？')) return;
        
        setActionLoading(id);
        try {
            // ★★★ 这里的 id 必须是字符串，不能是对象
            const res = await fetch(`${API_BASE_URL}/finance/payments/${id}/verify`, {
                method: 'PUT', // 注意后端是 PUT 方法
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                alert('审核通过，订单已更新！');
                fetchRecords(); // 刷新列表
            } else {
                const txt = await res.text();
                alert('操作失败: ' + txt);
            }
        } catch (e) {
            console.error(e);
            alert('网络错误');
        } finally {
            setActionLoading(null);
        }
    };

    // 驳回逻辑 (暂未实现后端接口，先做前端占位)
    const handleReject = async (id: string) => {
        const reason = prompt("请输入驳回原因：");
        if (!reason) return;
        alert("暂未实现驳回接口，请联系开发人员配置");
    };

    // 辅助函数：拼接完整图片路径
    const getFullUrl = (path: string) => {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        const baseUrl = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
        return `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">财务审核</h1>
                    <p className="text-sm text-gray-500 mt-1">请核对银行流水与销售提交的凭证是否一致</p>
                </div>
                <button onClick={fetchRecords} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50">
                    刷新列表
                </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-indigo-50/50 flex items-center gap-2">
                    <CheckCircle size={18} className="text-indigo-600"/>
                    <span className="font-bold text-indigo-900">待审核流水 ({records.length})</span>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                        <Loader2 className="animate-spin mb-2"/> 加载中...
                    </div>
                ) : records.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                        🎉 太棒了，所有款项都已核对完毕！
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-medium">
                                <tr>
                                    <th className="p-4">提交时间 / 销售</th>
                                    <th className="p-4">关联订单 / 客户</th>
                                    <th className="p-4">付款方信息</th>
                                    <th className="p-4 text-right">核销金额</th>
                                    <th className="p-4 text-center">凭证</th>
                                    <th className="p-4 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {records.map(record => (
                                    <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="p-4">
                                            <div className="text-gray-900 font-medium">
                                                {new Date(record.created_at).toLocaleString('zh-CN', {
                                                    month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit'
                                                })}
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                                <User size={12}/> {record.sales_name}
                                            </div>
                                        </td>
                                        <td className="p-4 max-w-xs">
                                            <div className="font-bold text-gray-800 break-words">{record.order.customer}</div>
                                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-1 font-mono">
                                                <FileText size={12}/> {record.order.order_no}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium text-gray-900">{record.payer_name}</div>
                                            <div className="text-xs text-gray-500 mt-0.5">
                                                {record.channel === 'bank_transfer' ? '对公转账' : record.channel}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="text-lg font-bold text-emerald-600">
                                                ¥{(record.amount_cents / 100).toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            {record.proof_url ? (
                                                <a 
                                                    href={getFullUrl(record.proof_url)} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
                                                >
                                                    <ExternalLink size={12}/> 查看凭证
                                                </a>
                                            ) : (
                                                <span className="text-gray-300 text-xs">无凭证</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right space-x-2">
                                            <button 
                                                onClick={() => handleReject(record.id)}
                                                disabled={!!actionLoading}
                                                className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
                                            >
                                                <XCircle size={14} className="inline mr-1"/> 驳回
                                            </button>
                                            
                                            {/* ★★★ 关键修复：onClick 中只传递 id 字符串 */}
                                            <button 
                                                onClick={() => handleVerify(record.id)}
                                                disabled={actionLoading === record.id}
                                                className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center"
                                            >
                                                {actionLoading === record.id ? (
                                                    <Loader2 size={14} className="animate-spin mr-1"/>
                                                ) : (
                                                    <CheckCircle size={14} className="mr-1"/>
                                                )}
                                                确认到账
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}