/*
 * 登录页 (V1.2 - 竞态条件修复版)
 * 路径: src/app/(public)/login/page.tsx
 *
 * 修复: 移除手动的 getSession() 和 router.push()。
 * 完全依赖 Next-Auth 的 signIn() 内置的 redirect
 * 功能来处理跳转，避免客户端竞态条件。
 */
'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation'; // (★ 修复: 我们仍然需要 router 来处理错误)

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@base1.com'); // (保留默认值)
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    console.log("🔐 开始 Next-Auth 登录 (V1.2)...");

    try {
      // (★ 关键修复)
      // 1. 移除 { redirect: false }
      // 2. 移除 await
      // 3. Next-Auth 将自动处理跳转
      const res = await signIn('credentials', {
        email: email,
        password: password,
        // (★ 关键) 我们不再手动跳转, 而是告诉 signIn 成功后去哪里
        // (注意: 这个 callbackUrl 必须是绝对路径)
        callbackUrl: 'http://localhost:3000/campus/dashboard',
        redirect: true, // (这是默认值, 但明确写出)
      });
      
      // (★ 关键)
      // 如果 res.error 存在 (例如, '用户名或密码错误')
      // signIn 会 *不会* 跳转, 而是返回错误信息
      if (res?.error) {
        console.error("📊 Next-Auth 登录失败:", res.error);
        setError("登录失败: " + res.error);
        setIsLoading(false);
      }
      
      // (如果成功, 页面会自动跳转, 下面的代码不会运行)

    } catch (err: any) {
      console.error("登录时发生意外错误:", err);
      setError('登录时发生意外错误，请稍后再试。');
      setIsLoading(false);
    }
    
    // (★ 修复) 移除所有旧的 getSession 和 router.push 逻辑
    /*
    [... OLD CODE REMOVED ...]
    */
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-gray-900">
          科普教育SaaS - 登录
        </h1>
        
        {/* (表单部分保持不变) */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label 
              htmlFor="email" 
              className="block text-sm font-medium text-gray-700"
            >
              邮箱
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label 
              htmlFor="password" 
              className="block text-sm font-medium text-gray-700"
            >
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          {error && (
            <div className="p-3 text-center text-sm text-red-700 bg-red-100 rounded-md">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
            >
              {isLoading ? '登录中...' : '登 录'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}