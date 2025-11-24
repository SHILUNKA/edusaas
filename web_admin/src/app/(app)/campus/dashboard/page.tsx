/*
 * 校区看板 (V1.2 - 竞态条件修复版)
 * 路径: src/app/(app)/campus/dashboard/page.tsx
 *
 * 修复 1: 移除本页面的 "认证锁" (if !session)，
 * 完全信任 (app)/layout.tsx 中的 "认证锁" 来保护此页面。
 * 修复 2: 正确使用 user.rawToken
 * 修复 3: 正确导入并使用 StatsCards, UpcomingClasses, StockAlerts 组件
 */
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { redirect } from 'next/navigation'; // <-- (我们仍然需要 redirect)

// 导入你的客户端组件
import { StatsCards } from './StatsCards';
import { UpcomingClasses } from './UpcomingClasses';
import { StockAlerts } from './StockAlerts';

console.log("🏁 (3/3) 正在加载: (dashboard) 最终页面 /dashboard/page.tsx (V1.2)");

// --- (API 客户端保持不变) ---
async function apiGetWithSession<T>(endpoint: string, accessToken: string): Promise<T> {
  const response = await fetch(`http://edusaas_core_api:8000${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`, //
      'Content-Type': 'application/json',
    },
    cache: 'no-store', 
  });

  if (!response.ok) {
    console.error(`API Error for ${endpoint}: ${response.status}`);
    // (★ 关键) 如果 Token 失效 (401), 我们也踢回登录页
    if (response.status === 401) {
        redirect('/login');
    }
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

// --- (接口类型保持不变) ---
interface IBaseDashboardStats {
  participant_count: number;
  member_count: number;
  today_class_count: number;
}
interface IUpcomingClass {
  id: string;
  course_name_key: string; 
  start_time: string;
  teacher_name: string;
  room_name: string;
}
interface IStockAlert {
  material_id: string;
  name_key: string;
  current_stock: number;
}

// --- (数据获取函数保持不变) ---
async function getDashboardData(accessToken: string | undefined) {
  // (★ 修复) 增加一个检查，如果 token 不存在就不发请求
  if (!accessToken) {
    throw new Error("Access Token 为空");
  }
  
  try {
    const [stats, classes, stock] = await Promise.all([
      apiGetWithSession<IBaseDashboardStats>('/api/v1/base/dashboard/stats', accessToken),
      apiGetWithSession<IUpcomingClass[]>('/api/v1/base/classes', accessToken), //
      apiGetWithSession<IStockAlert[]>('/api/v1/base/stock/alerts', accessToken), //
    ]);

    return { stats, classes, stock };
  } catch (error: any) {
    console.error('获取仪表板数据失败:', error.message);
    // (★ 关键) 如果是 Token 错误, 我们需要让页面重定向
    if (error.message.includes("401") || error.message.includes("Token 为空")) {
      redirect('/login');
    }
    // (对于其他错误, 返回0)
    return {
      stats: { participant_count: 0, member_count: 0, today_class_count: 0 },
      classes: [],
      stock: []
    };
  }
}

// --- (页面组件 ★ 已修复★) ---
export default async function CampusDashboardPage() {
  
  // (★ 修复) 我们仍然获取 Session, 但主要目的是为了获取 Token 和 Roles
  const session = await getServerSession(authOptions);

  // (★ 修复) 
  // (app)/layout.tsx 已经检查了 !session, 
  // 但我们在这里再次检查, 以防 layout 被移除。
  // 并且, 我们主要检查 token。
  if (!session?.user?.rawToken) {
    console.log('Session 或 rawToken 未找到，重定向到登录页');
    redirect('/login');
  }

  const { user } = session;
  console.log('👤 Session 用户:', user.email); // (日志简化)

  // (★ 修复) 权限检查逻辑保持不变
  const isCampusAdmin = user.roles.includes('role.base.admin');
  const isTenantAdmin = user.roles.includes('role.tenant.admin');

  if (!isCampusAdmin && !isTenantAdmin) {
    console.log('用户没有管理员权限');
    redirect('/login');
  }
  if (isTenantAdmin && !user.base_id && !isCampusAdmin) {
    console.log('总部管理员，重定向到总部仪表板');
    redirect('/tenant/dashboard'); //
  }

  // (★ 修复) 传入 user.rawToken
  const { stats, classes, stock } = await getDashboardData(user.rawToken); //

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">
        校区看板
        <span className="text-sm font-normal text-gray-600 ml-2">
          ({user.email})
        </span>
      </h1>
      
      {/* (使用你的客户端组件) */}
      <StatsCards stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <UpcomingClasses classes={classes} />
        </div>
        <div>
          <StockAlerts alerts={stock} />
        </div>
      </div>
    </div>
  );
}