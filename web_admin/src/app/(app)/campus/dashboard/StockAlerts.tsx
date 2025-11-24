// src/components/dashboard/campus/StockAlerts.tsx
"use client"; // 这是一个客户端组件

export function StockAlerts({ alerts }: { alerts: any[] }) {
  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4 text-red-600">运营警报</h2>
      {alerts.length === 0 ? (
        <p className="text-gray-500">所有物料库存充足。</p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((alert) => (
            <li key={alert.material_id} className="p-3 bg-red-50 rounded-lg">
              <p className="font-semibold text-red-700">{alert.name_key}</p>
              <p className="text-sm text-red-500">
                库存仅剩: {alert.current_stock}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}