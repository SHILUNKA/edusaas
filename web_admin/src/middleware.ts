import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    const userRoles = (token?.roles as string[]) || [];

    // 打印日志方便调试 (上线可删)
    // console.log(`[Middleware] Path: ${path}, Roles: ${userRoles}`);

    // --- 1. 保护总部路由 (/tenant) ---
    // 规则：只要拥有任意一个 "role.tenant.xxx" 的角色，就允许进入总部区域
    // (具体的页面权限，如“财务只能看钱”，由页面内部逻辑控制)
    if (path.startsWith("/tenant")) {
      const isTenantStaff = userRoles.some(r => r.startsWith("role.tenant"));
      
      if (!isTenantStaff) {
        // 如果是误入的校区员工，送回校区看板
        if (userRoles.some(r => r.startsWith("role.base"))) {
            return NextResponse.redirect(new URL("/campus/dashboard", req.url));
        }
        // 否则踢回登录
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }

    // --- 2. 保护分校路由 (/campus) ---
    // 规则：只要拥有任意 "role.base.xxx" 角色，或者是总部老板(admin)，就允许进入
    if (path.startsWith("/campus")) {
      const isBaseStaff = userRoles.some(r => r.startsWith("role.base"));
      const isBoss = userRoles.includes("role.tenant.admin"); 
      // 假设总部运营也能看分校，可以在这里加 || userRoles.includes("role.tenant.operation")

      if (!isBaseStaff && !isBoss) {
        // 如果是误入的总部财务(他不需要看分校)，送回总部看板
        if (userRoles.some(r => r.startsWith("role.tenant"))) {
            return NextResponse.redirect(new URL("/tenant/dashboard", req.url));
        }
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }
    
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/tenant/:path*",
    "/campus/:path*",
    "/admin/:path*", 
    // 保护 dashboard 防止未登录访问
    "/dashboard/:path*" 
  ]
};