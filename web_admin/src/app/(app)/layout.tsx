/*
 * SaaS B端主应用框架 (V5 - 智能侧边栏版)
 * 路径: src/app/(app)/layout.tsx
 */
'use client'; 

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation'; 
import { useSession, signOut } from 'next-auth/react'; 

// (★ 关键) 导入我们新的侧边栏组件
import { TenantSidebar } from './components/TenantSidebar';
import { CampusSidebar } from './components/CampusSidebar';

/*
 * 1. 顶栏 (Topbar) 组件
 * (保持不变)
 */
function Topbar() {
  const { data: session } = useSession(); 

  const handleLogout = () => {
    signOut({ callbackUrl: '/login' }); 
  };

  return (
    <div className="h-16 bg-white shadow-md flex items-center justify-end px-8">
      <div className="flex items-center space-x-4">
        <span>
          欢迎, {session?.user ? session.user.email : '访客'}
        </span>
        <button 
          onClick={handleLogout}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          退出登录
        </button>
      </div>
    </div>
  );
}

/*
 * 2. 智能侧边栏 "选择器"
 * (★ 关键)
 */
function SmartSidebar() {
  const { data: session } = useSession();
  const user = session?.user;

  if (!user) {
    return null; // (在认证锁生效前, 不显示任何侧边栏)
  }

  // (★ 核心SaaS逻辑)
  // 如果用户是总部管理员 (且没有 base_id, 意味着在总部), 显示总部菜单
  if (user.roles.includes('role.tenant.admin') && !user.base_id) {
    return <TenantSidebar />;
  }
  
  // 如果用户是基地管理员 (或任何有 base_id 的人), 显示基地菜单
  if (user.roles.includes('role.base.admin') && user.base_id) {
    return <CampusSidebar />;
  }

  // (备用) 如果用户是总部管理员, 但 '访问' 了一个基地
  // (V2 逻辑: 我们暂时先按角色区分)
  if (user.roles.includes('role.tenant.admin')) {
      return <TenantSidebar />;
  }

  // 默认或未知情况, 显示基地菜单 (或一个错误)
  return <CampusSidebar />;
}


/*
 * 3. 我们的主布局 (Layout)
 * (★ 关键)
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // --- (认证锁 保持不变) ---
  const router = useRouter();
  const { status } = useSession(); 
  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated';
  
  useEffect(() => {
    if (isLoading) {
      return; 
    }
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]); 

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        (Next-Auth) 正在加载, 或正在重定向...
      </div>
    );
  }
  // --- (认证锁 结束) ---

  return (
    <div className="flex h-screen bg-gray-100">
      
      {/* (★ 关键) 使用我们的智能侧边栏 "选择器" */}
      <SmartSidebar />
      
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}