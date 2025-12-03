// src/app/(app)/components/TenantSidebar.tsx
'use client';
import Link from 'next/link';
import { Wallet } from 'lucide-react';

// (图标组件们... 保持不变)
const HomeIcon = () => <span>🏠</span>;
const BasesIcon = () => <span>🏢</span>;
const CoursesIcon = () => <span>📚</span>;
const AssetsIcon = () => <span>📦</span>;
const MembersIcon = () => <span>👥</span>;
const SettingsIcon = () => <span>⚙️</span>;

export function TenantSidebar() {
  const menuItems = [
    { name: "全局看板", href: "/tenant/dashboard", icon: HomeIcon },
    { 
        name: "财务中心", 
        href: "/tenant/finance", 
        icon: () => <Wallet size={20} /> 
    },
    { name: "基地管理", href: "/tenant/bases", icon: BasesIcon },
    { name: "学员总览", href: "/tenant/participants", icon: MembersIcon },
    { name: "中央课程库", href: "/tenant/courses", icon: CoursesIcon },
    { name: "中央资源库", href: "#", icon: AssetsIcon, subMenu: [
        { name: "教室/场地", href: "/tenant/rooms" }, 
        { name: "资产库(类型)", href: "/tenant/assets" }, 
        { name: "物料库(定义)", href: "/tenant/materials" },
    ]},
    { name: "会员体系", href: "#", icon: MembersIcon, subMenu: [
        { name: "荣誉军衔", href: "/admin/honor-ranks" },
        { name: "商业会员卡", href: "/tenant/membership-tiers" },
    ]},
    { name: "员工与权限", href: "/tenant/users", icon: SettingsIcon },
  ];

  return (
    <div className="w-64 bg-gray-900 text-white h-screen p-4 flex flex-col">
      <div className="text-2xl font-bold mb-8">科普SaaS (总部)</div>
      <nav>
        <ul>
          {menuItems.map((item) => (
            <li key={item.name} className="mb-2">
              <Link href={item.href} className="flex items-center p-2 rounded hover:bg-gray-700">
                <item.icon />
                <span className="ml-3">{item.name}</span>
              </Link>
              {item.subMenu && (
                <ul className="ml-6 mt-1 space-y-1">
                  {item.subMenu.map((sub) => (
                    <li key={sub.name}>
                      <Link href={sub.href} className="p-2 text-sm rounded hover:bg-gray-700 block">
                        {sub.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}