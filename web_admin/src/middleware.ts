import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    const userRoles = (token?.roles as string[]) || [];

    // 打印日志方便调试 (上线可删)
    // console.log(`[Middleware] Path: ${path}, Roles: ${userRoles}`);

    // --- 1. 保护总部路由 (/hq) ---
    // 规则：只要拥有任意一个 "role.hq.xxx" 的角色，就允许进入总部区域
    // (具体的页面权限，如“财务只能看钱”，由页面内部逻辑控制)
    if (path.startsWith("/hq")) {
      const isTenantStaff = userRoles.some(r => r.startsWith("role.hq"));
      
      if (!isTenantStaff) {
        // 如果是误入的校区员工，送回校区看板
        if (userRoles.some(r => r.startsWith("role.base"))) {
            return NextResponse.redirect(new URL("/base/dashboard", req.url));
        }
        // 否则踢回登录
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }

    // --- 2. 保护分校路由 (/base) ---
    // 规则：只要拥有任意 "role.base.xxx" 角色，或者是总部老板(admin)，就允许进入
    if (path.startsWith("/base")) {
      const isBaseStaff = userRoles.some(r => r.startsWith("role.base"));
      const isBoss = userRoles.includes("role.hq.admin"); 
      // 假设总部运营也能看分校，可以在这里加 || userRoles.includes("role.hq.operation")

      if (!isBaseStaff && !isBoss) {
        // 如果是误入的总部财务(他不需要看分校)，送回总部看板
        if (userRoles.some(r => r.startsWith("role.hq"))) {
            return NextResponse.redirect(new URL("/hq/dashboard", req.url));
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
    "/hq/:path*",
    "/base/:path*",
    "/admin/:path*", 
    // 保护 dashboard 防止未登录访问
    "/dashboard/:path*" 
  ]
};