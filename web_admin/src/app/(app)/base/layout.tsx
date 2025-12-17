// src/app/(app)/base/layout.tsx

console.log("🏁 (3/3) 正在加载: (dashboard) 最终页面 /dashboard/page.tsx"); // <--- 添加这行

import React from "react";
// (未来: 在这里导入 <CampusSidebar />)

export default function CampusAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      {/* (未来) 这是一个放置“校区”专属侧边栏的好地方
        <CampusSidebar /> 
      */}
      <main className="flex-1 p-6 bg-gray-50 overflow-auto">
        {/* 'overflow-auto' 确保内容过长时可以滚动 */}
        {children}
      </main>
    </div>
  );
}