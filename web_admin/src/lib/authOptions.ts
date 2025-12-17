// web_admin/src/lib/authOptions.ts
import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { jwtDecode } from "jwt-decode";

// 1. 完善接口定义 (与 Rust Claims 对应)
interface ITokenClaims {
  sub: string;
  hq_id: string;
  base_id: string | null;
  // ★ 新增
  base_name: string | null; 
  base_logo: string | null;
  roles: string[];
  exp: number;
}

const CORE_API_URL = process.env.CORE_API_URL || "http://edusaas_core_api:8000/api/v1";

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        try {
          const res = await fetch(`${CORE_API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });
          
          if (!res.ok) throw new Error("用户名或密码错误");

          const data = await res.json();
          const token = data.token;
          if (!token) throw new Error("Rust API 未返回 Token");

          // 解码 Token
          const decodedClaims = jwtDecode<ITokenClaims>(token);

          // ★ 返回给 NextAuth 的 User 对象 (包含所有字段)
          return {
            id: decodedClaims.sub,
            email: credentials.email,
            // 展开所有 Claims (roles, base_name, base_logo 等都在这里)
            ...decodedClaims, 
            rawToken: token,
          };

        } catch (e: any) {
          console.error("Authorize Error:", e);
          throw new Error(e.message || "登录失败");
        }
      },
    }),
  ],

  callbacks: {
    // ★ 修复: 将 User 里的新字段拷贝到 Token
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.rawToken = user.rawToken;
        token.hq_id = user.hq_id;
        token.base_id = user.base_id;
        token.roles = user.roles;
        // ★ 关键补充
        token.base_name = user.base_name;
        token.base_logo = user.base_logo;
      }
      return token;
    },
    
    // ★ 修复: 将 Token 里的新字段暴露给 Session (前端才能拿到)
    async session({ session, token }) {
      session.user.id = token.sub;
      session.user.rawToken = token.rawToken;
      session.user.hq_id = token.hq_id;
      session.user.base_id = token.base_id;
      session.user.roles = token.roles;
      // ★ 关键补充
      session.user.base_name = token.base_name;
      session.user.base_logo = token.base_logo;
      
      return session;
    },
  },

  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: '/login' }
};