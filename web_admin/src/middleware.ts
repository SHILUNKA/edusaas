import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  // 'withAuth' 接收一个 middleware 函数，可以在这里做精细的权限判断
  function middleware(req) {
    // 获取用户 token (NextAuth 自动解析)
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    const userRoles = (token?.roles as string[]) || [];

    // --- 1. 保护总部路由 (/tenant) ---
    // 只有 'role.tenant.admin' 才能访问
    if (path.startsWith("/tenant")) {
      if (!userRoles.includes("role.tenant.admin")) {
        // 权限不足，重定向到校区看板(或者一个403页面)
        // 这里我们简单处理：如果他是基地管理员，踢回基地；否则踢回登录
        if (userRoles.includes("role.base.admin") || userRoles.includes("role.teacher")) {
           return NextResponse.redirect(new URL("/campus/dashboard", req.url));
        }
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }

    // --- 2. 保护分店路由 (/campus) ---
    // 必须是 'role.base.admin' 或 'role.teacher' 或 'role.tenant.admin'(视业务而定)
    if (path.startsWith("/campus")) {
      const hasAccess = 
        userRoles.includes("role.base.admin") || 
        userRoles.includes("role.teacher") ||
        userRoles.includes("role.tenant.admin"); // 假设总部也能看分店

      if (!hasAccess) {
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }
    
    return NextResponse.next();
  },
  {
    // --- 配置项 ---
    callbacks: {
      // authorized 返回 true 表示“已登录”，才会进入上面的 middleware 函数逻辑
      // 返回 false 则直接跳到登录页
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login", // 指定未登录时跳转的地址
    },
  }
)

// --- 路由匹配规则 ---
export const config = {
  matcher: [
    // 只有匹配这些路径的请求才会被中间件拦截
    "/tenant/:path*",
    "/campus/:path*",
    "/admin/:path*", 
    // (注意：不要包含 /login 或 /api/auth，否则会死循环)
  ]
}