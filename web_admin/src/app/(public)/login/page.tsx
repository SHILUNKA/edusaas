/*
 * 登录页 (V2.0 - 角色路由分发版)
 * 路径: src/app/(public)/login/page.tsx
 * 修复: 移除硬编码的 callbackUrl，根据用户角色动态跳转到对应的 Dashboard。
 */
'use client';
import { useState } from 'react';
import { signIn, getSession } from 'next-auth/react'; // (★ 引入 getSession)
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  // 默认值改回空或你常用的测试账号
  const [email, setEmail] = useState('hq@admin.com'); 
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // 1. 执行登录，但禁止自动跳转 (redirect: false)
      const res = await signIn('credentials', {
        email: email,
        password: password,
        redirect: false, // (★ 关键修改)
      });
      
      if (res?.error) {
        console.error("登录失败:", res.error);
        setError("登录失败: 用户名或密码错误");
        setIsLoading(false);
        return;
      }

      // 2. 登录成功后，手动获取最新的 Session 以检查角色
      // (注意: 这里需要 await getSession 确保获取到更新后的状态)
      const session = await getSession();
      const roles = session?.user?.roles || [];
      const baseId = session?.user?.base_id;

      console.log("登录成功，角色:", roles);

      // 3. 根据角色进行路由分发
      if (roles.includes('role.tenant.admin')) {
        // 如果是总部管理员 (且没有绑定特定基地，或者优先去总部看板)
        router.push('/tenant/dashboard');
      } else if (roles.includes('role.base.admin') || roles.includes('role.teacher')) {
        // 如果是基地校长或老师
        router.push('/campus/dashboard');
      } else {
        // 未知角色，默认去首页或报错
        console.warn("未知角色，无法重定向");
        setError("账号角色异常，无法进入系统");
        setIsLoading(false);
      }

    } catch (err: any) {
      console.error("登录错误:", err);
      setError('系统错误，请稍后再试');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-gray-900">
          科普教育SaaS - 登录
        </h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              邮箱账号
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 transition-colors"
            >
              {isLoading ? '正在跳转...' : '登 录'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}