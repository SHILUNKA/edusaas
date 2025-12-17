// web_admin/src/types/next-auth.d.ts

import NextAuth, { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * 扩展 Session 里的 user 对象
   */
  interface Session {
    user: {
      id: string;
      rawToken: string;
      hq_id: string;
      base_id: string | null;
      // ★ 新增字段
      base_name: string | null;
      base_logo: string | null;
      roles: string[];
    } & DefaultSession["user"];
  }

  /**
   * 扩展 User 对象 (authorize 返回的值)
   */
  interface User {
    id: string;
    rawToken: string;
    hq_id: string;
    base_id: string | null;
    base_name: string | null;
    base_logo: string | null;
    roles: string[];
  }
}

declare module "next-auth/jwt" {
  /**
   * 扩展 JWT Token 对象
   */
  interface JWT {
    sub: string;
    rawToken: string;
    hq_id: string;
    base_id: string | null;
    base_name: string | null;
    base_logo: string | null;
    roles: string[];
  }
}