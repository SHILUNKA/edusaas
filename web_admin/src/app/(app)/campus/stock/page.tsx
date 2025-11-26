'use client';

import { API_BASE_URL } from '@/lib/config';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

// (★ 复用类型: 后端返回的结构体字段是一样的)
interface StockItem {
  material_id: string;
  name_key: string;
  current_stock: number;
  // (注意: 这里暂时没有 SKU 和 Unit，如果需要，得在后端 SQL 里加字段)
}

export default function StockPage() {
  const { data: session } = useSession();
  const token = session?.user?.rawToken;

  const [alerts, setAlerts] = useState<StockItem[]>([]);
  const [allStocks, setAllStocks] = useState<StockItem[]>([]); // (★ 改名)
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      setIsLoading(true);

      try {
        // 1. 获取库存预警
        const alertsRes = await fetch(`${API_BASE_URL}/base/stock/alerts`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // 2. (★ 修改) 获取全量实时库存
        const stockRes = await fetch(`${API_BASE_URL}/base/stock`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (alertsRes.ok) setAlerts(await alertsRes.json());
        if (stockRes.ok) setAllStocks(await stockRes.json());

      } catch (error) {
        console.error("Failed to fetch stock data", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [token]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">物料与库存管理</h1>
        <button className="px-4 py-2 bg-gray-300 text-white rounded-md cursor-not-allowed" title="后端接口暂未实现">
          + 手动入库 (开发中)
        </button>
      </div>

      {/* --- 模块 1: 紧急库存预警 --- */}
      {/* (保持不变，略...) */}

      {/* --- 模块 2: 实时库存列表 (★ 修改) --- */}
      <section className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">全量实时库存</h2>
        
        {allStocks.length === 0 ? (
          <p className="text-gray-500">暂无库存数据。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">物料名称</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">当前库存</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {allStocks.map((item) => (
                  <tr key={item.material_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{item.name_key}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-sm font-bold ${
                            item.current_stock < 5 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                            {item.current_stock}
                        </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.current_stock < 5 ? '需补货' : '充足'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}