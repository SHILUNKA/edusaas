// (在 src/app/(app)/admin/base/dashboard/page.tsx)
//
// 这是一个 React Server Component (RSC), 它在服务器上运行

import { auth } from "@/lib/auth"; // (假设: 您从 cookie 获取 session 的辅助函数)
import { api } from "@/lib/api";     // (假设: 您用于获取数据的辅助函数)
import { StatCard } from "@/components/ui/StatCard";
import { UpcomingClasses } from "@/components/dash/UpcomingClasses";
import { StockAlerts } from "@/components/dash/StockAlerts";

// (★ 关键) 我们需要3个新的数据类型
interface IBaseDashboardStats {
  participant_count: number;
  member_count: number;
  today_class_count: number;
}
interface IUpcomingClass {
  id: string;
  name_key: string; // (我们需要 JOIN courses 表来获取)
  start_time: string;
  teacher_name: string; // (我们需要 JOIN teachers 表来获取)
  room_name: string;    // (我们需要 JOIN rooms 表来获取)
  enrollment_count: number;
  max_capacity: number;
}
interface IStockAlert {
  material_name_key: string;
  remaining_stock: number;
}


// (★ 关键) 在服务器组件中并行获取所有数据
async function getDashboardData(token: string) {
  // (我们假设 api.get 会自动附加 Authorization: Bearer token)
  
  // (我们需要创建这3个 API)
  const statsPromise = api.get<IBaseDashboardStats>('/base/dashboard/stats', token);
  const classesPromise = api.get<IUpcomingClass[]>('/base/classes?date=today', token);
  const stockPromise = api.get<IStockAlert[]>('/base/stock/alerts', token);

  // (并行触发所有请求)
  const [stats, classes, stock] = await Promise.all([
    statsPromise,
    classesPromise,
    stockPromise
  ]);

  return { stats, classes, stock };
}


// (★ 页面组件 ★)
export default async function BaseDashboardPage() {
  // 1. 获取 Session/Token (在服务器上)
  const session = await auth(); // (例如: 从 authStore 或 cookie)
  
  // 2. (★ 关键) 检查角色
  // (如果 session.user.base_id 为 null, 说明是总部, 重定向到 /admin/tenant)
  if (!session?.user?.base_id) {
     // redirect("/admin/tenant/dashboard");
     // (或者显示一个“您是总部”的视图)
  }
  
  // 3. (★ 关键) 获取数据
  // (这会在页面加载时在服务器上运行, 速度很快)
  const { stats, classes, stock } = await getDashboardData(session.token);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold">分店看板 ( {session.user.base_name} )</h1>

      {/* --- 组件 A: 关键指标 --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="活跃学员" value={stats.participant_count} />
        <StatCard title="活跃会员" value={stats.member_count} />
        <StatCard title="今日排课" value={stats.today_class_count} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* --- 组件 B: 今日待办 --- */}
        <UpcomingClasses classes={classes} />

        {/* --- 组件 C: 运营警报 --- */}
        <StockAlerts alerts={stock} />
      </div>
    </div>
  );
}