'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

// --- 类型定义 ---
interface StockAlert {
  material_id: string;
  name_key: string;
  current_stock: number;
}

interface Material {
  id: string;
  name_key: string;
  sku: string | null;
  unit_of_measure: string | null;
  description_key: string | null;
}

export default function StockPage() {
  const { data: session } = useSession();
  const token = session?.user?.rawToken;

  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- 数据获取 ---
  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      setIsLoading(true);

      try {
        // 1. 获取库存预警
        const alertsRes = await fetch('http://localhost:8000/api/v1/base/stock/alerts', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // 2. 获取物料字典 (作为参考)
        const matRes = await fetch('http://localhost:8000/api/v1/materials', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (alertsRes.ok) setAlerts(await alertsRes.json());
        if (matRes.ok) setMaterials(await matRes.json());

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
        {/* 暂时没有后端 API 支持手动入库，所以按钮置灰 */}
        <button className="px-4 py-2 bg-gray-300 text-white rounded-md cursor-not-allowed" title="后端接口暂未实现">
          + 手动入库 (开发中)
        </button>
      </div>

      {/* --- 模块 1: 紧急库存预警 --- */}
      <section className="bg-white p-6 rounded-lg shadow-md border-l-4 border-red-500">
        <h2 className="text-xl font-semibold mb-4 text-red-700 flex items-center gap-2">
          <span>⚠️</span> 库存预警 (低于 5 件)
        </h2>
        
        {isLoading ? (
          <p>加载中...</p>
        ) : alerts.length === 0 ? (
          <p className="text-green-600">✅ 当前没有库存紧张的物料。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-red-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">物料名称</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">当前库存</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">状态</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {alerts.map((item) => (
                  <tr key={item.material_id}>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{item.name_key}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-red-600 font-bold">{item.current_stock}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-500">补货急需</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- 模块 2: 物料名录 --- */}
      <section className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">物料名录 (总部定义)</h2>
        <p className="text-sm text-gray-500 mb-4">这里列出了所有可用的物料定义。如需查看完整实时库存，需要后端添加 `/api/v1/base/stock` 接口。</p>
        
        {materials.length === 0 ? (
          <p className="text-gray-500">暂无物料定义。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名称 (Key)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">单位</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">描述</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {materials.map((mat) => (
                  <tr key={mat.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">{mat.name_key}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">{mat.sku || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">{mat.unit_of_measure || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-sm">{mat.description_key || '-'}</td>
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