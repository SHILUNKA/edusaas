// src/lib/authOptions.ts
import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { jwtDecode } from "jwt-decode";

// (★ 关键: 确保这个 TS 接口与您 Rust 'Claims' 结构体 100% 匹配)
interface ITokenClaims {
  sub: string;           // (User ID)
  tenant_id: string;
  base_id: string | null; // (★ 我们最关心的字段)
  roles: string[];
  exp: number;
}

// (★ 关键) 您的后端 API (Rust) 的地址
const CORE_API_URL = process.env.CORE_API_URL || "http://edusaas_core_api:8000/api/v1";

export const authOptions: AuthOptions = {
  // 1. 我们使用 "Credentials" (用户名密码) 登录
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      
      // 2. (★ 核心) "authorize" 函数告诉 Next-Auth 如何验证用户
      async authorize(credentials) {
        if (!credentials) return null;

        try {
          // 3. (Next.js 服务器) 调用 (Rust 后端)
          const res = await fetch(`${CORE_API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });
          
          if (!res.ok) {
            // (例如, Rust API 返回 401 Unauthorized)
            console.error("Rust API Login Failed:", res.status, res.statusText);
            // (向 Next-Auth 抛出错误, 会在登录页显示)
            throw new Error("用户名或密码错误"); 
          }

          // 4. (★ 关键) 登录成功, 获取 Rust API 返回的原始 Token
          const data = await res.json();
          const token = data.token;
          
          if (!token) {
            throw new Error("Rust API 未返回 Token");
          }

          // 5. (★ 关键) 解码 Token, 获取 'user' 对象 (Claims)
          const decodedClaims = jwtDecode<ITokenClaims>(token);

          // 6. (★ 关键) 返回这个对象, Next-Auth 会将其存入 *自己的* JWT
          return {
            id: decodedClaims.sub, // (Next-Auth 期望一个 'id' 字段)
            email: credentials.email,
            ...decodedClaims,      // (我们把 base_id, roles 等所有信息都放进去)
            rawToken: token,       // (我们把 *原始* Token 也存起来, 供 API 调用)
          };

        } catch (e: any) {
          console.error("Authorize Error:", e);
          // (将错误信息传递给登录页面)
          throw new Error(e.message || "登录时发生未知错误");
        }
      },
    }),
  ],

  // 7. (★ 核心) Callbacks (回调)
  // (这些回调用于将数据从 "authorize" 传递到 Next-Auth 的 Session 中)
  callbacks: {
    // 'jwt' 回调在 'authorize' 之后运行
    // 它负责将数据 *加密* 进 Next-Auth 的 JWT Cookie
    async jwt({ token, user }) {
      // 'user' 参数只在 *第一次* 登录时 (authorize 之后) 才可用
      if (user) {
        // (将我们 'authorize' 返回的数据, 附加到 Next-Auth 的 token 上)
        token.sub = user.id;
        token.rawToken = (user as any).rawToken;
        token.base_id = (user as any).base_id;
        token.tenant_id = (user as any).tenant_id;
        token.roles = (user as any).roles;
        token.email = (user as any).email;
      }
      return token;
    },
    
    // 'session' 回调在客户端/服务器端获取 Session 时运行
    // 它负责将 *已解密* 的 JWT 数据, 暴露给您的 React 组件
    async session({ session, token }) {
      // (将我们附加在 'token' 上的数据, 暴露给 'session.user' 对象)
      session.user.id = token.sub as string;
      session.user.rawToken = token.rawToken as string;
      session.user.base_id = token.base_id as string | null;
      session.user.tenant_id = token.tenant_id as string;
      session.user.roles = token.roles as string[];
      session.user.email = token.email as string;
      
      return session;
    },
  },

  // (★ 关键) 我们使用 JWT 策略 (而不是数据库) 来管理 Session
  session: {
    strategy: "jwt",
  },
  
  // (★ 关键) Next-Auth 需要一个密钥来签名它自己的 Cookie
  secret: process.env.NEXTAUTH_SECRET,
  
  // (★ 关键) 自定义登录页的路径
  pages: {
    signIn: '/login',
    // (可以添加: signOut: '/logout', error: '/auth/error')
  }
};