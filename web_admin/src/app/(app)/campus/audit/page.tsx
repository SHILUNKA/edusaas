'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { API_BASE_URL } from '@/lib/config';

// 类型定义保持不变...
interface PendingRecord {
  id: string;
  order_no: string;
  customer_name: string;
  payer_name: string;
  amount_cents: number;
  proof_image_url: string;
  created_at: string;
  sales_name: string;
}

export default function BaseFinanceAuditPage() {
  const { data: session } = useSession();
  const token = (session?.user as any)?.rawToken;
  
  // 获取当前用户的基地名称 (如果有的话，用于展示)
  const baseName = (session?.user as any)?.baseName || "本基地";

  const [records, setRecords] = useState<PendingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // 加载数据
  const fetchList = async () => {
    if (!token) return;
    setLoading(true);
    try {
      // 后端会自动根据 Token 里的 base_id 过滤数据
      const res = await fetch(`${API_BASE_URL}/finance/payments/pending`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setRecords(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, [token]);

  // 审核动作
  const handleVerify = async (id: string, action: 'APPROVE' | 'REJECT') => {
    if (!confirm(action === 'APPROVE' ? "确认款项已到账？" : "确定驳回此凭证？")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/finance/payments/verify`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ payment_record_id: id, action })
      });

      if (res.ok) {
        setRecords(prev => prev.filter(r => r.id !== id));
      } else {
        alert("操作失败，请重试");
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">财务审核 ({baseName})</h1>
          <p className="text-gray-500 text-sm">审核本基地销售上传的线下转账凭证</p>
        </div>
        <Button onClick={fetchList} variant="outline" size="sm">刷新</Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">待处理流水 ({records.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {/* 表格区域 - 完全复用之前的 Table 结构 */}
          <div className="relative w-full overflow-auto border rounded-md">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b">
                <tr>
                  <th className="px-4 py-3">提交时间</th>
                  <th className="px-4 py-3">关联订单</th>
                  <th className="px-4 py-3">客户 / 销售</th>
                  <th className="px-4 py-3">付款信息</th>
                  <th className="px-4 py-3 text-right">金额</th>
                  <th className="px-4 py-3 text-center">凭证</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.length === 0 ? (
                  <tr><td colSpan={7} className="p-12 text-center text-gray-400">🎉 今日无待审核款项</td></tr>
                ) : (
                  records.map(record => (
                    <tr key={record.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-mono text-gray-500 text-xs">
                        {new Date(record.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {record.order_no}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{record.customer_name}</div>
                        <div className="text-xs text-gray-500">销售: {record.sales_name}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {record.payer_name}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-indigo-600 font-mono">
                        ¥{(record.amount_cents / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                         {/* 实际项目中这里建议用 Dialog/Modal 预览大图 */}
                        <a href={record.proof_image_url} target="_blank" rel="noreferrer" className="inline-flex items-center px-2 py-1 rounded border text-xs hover:bg-gray-100">
                           查看图片
                        </a>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                            <Button 
                              size="sm" variant="ghost" className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleVerify(record.id, 'REJECT')}
                            >
                              驳回
                            </Button>
                            <Button 
                              size="sm" className="h-8 px-3 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleVerify(record.id, 'APPROVE')}
                            >
                              确认
                            </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}