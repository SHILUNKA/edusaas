// src/components/dashboard/campus/StatsCards.tsx
"use client"; // 这是一个客户端组件

// (一个简单的卡片 UI 组件 - 样式请自行替换)
const Card = ({ title, value }: { title: string, value: string | number }) => (
  <div className="p-6 bg-white rounded-lg shadow-md">
    <h3 className="text-sm font-medium text-gray-500">{title}</h3>
    <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
  </div>
);

export function StatsCards({ stats }: { stats: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card title="活跃学员" value={stats.participant_count} />
      <Card title="活跃会员" value={stats.member_count} />
      <Card title="今日排课" value={stats.today_class_count} />
    </div>
  );
}