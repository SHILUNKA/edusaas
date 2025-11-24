// src/app/(app)/components/CampusSidebar.tsx
'use client';
import Link from 'next/link';

// (图标组件们... 保持不变)
const HomeIcon = () => <span>🏠</span>;
const ClassesIcon = () => <span>📅</span>;
const MembersIcon = () => <span>👥</span>;
const StockIcon = () => <span>📦</span>;

export function CampusSidebar() {
  const menuItems = [
    { 
      name: "校区看板", 
      href: "/campus/dashboard", // (你已登录的页面)
      icon: HomeIcon 
    },
    { 
      name: "排课与消课", // (★ "开课" 在这里)
      href: "/campus/schedule", 
      icon: ClassesIcon 
    },
    { 
      name: "学员与会员", // (★ "开卡" 在这里)
      href: "/campus/memberships", 
      icon: MembersIcon 
    },
    { 
      name: "物料与库存", 
      href: "/campus/stock", 
      icon: StockIcon 
    },
  ];

  return (
    <div className="w-64 bg-gray-800 text-white h-screen p-4 flex flex-col">
      <div className="text-2xl font-bold mb-8">科普SaaS (基地)</div>
      <nav>
        <ul>
          {menuItems.map((item) => (
            <li key={item.name} className="mb-2">
              <Link href={item.href} className="flex items-center p-2 rounded hover:bg-gray-700">
                <item.icon />
                <span className="ml-3">{item.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}