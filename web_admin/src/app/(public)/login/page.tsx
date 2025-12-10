// web_admin/src/app/login/page.tsx
'use client';

import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const getRedirectPath = (roles: string[]): string => {
        if (roles.some(r => r.startsWith('role.tenant'))) return '/tenant/dashboard';
        if (roles.some(r => r.startsWith('role.base'))) return '/campus/dashboard';
        return '/'; 
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const result = await signIn('credentials', {
                email, password, redirect: false, 
            });

            if (result?.error) {
                setError('用户名或密码错误');
                setIsLoading(false);
                return;
            }

            // ★ 优化: 稍微等待 Cookie 写入，避免竞态条件
            await new Promise(r => setTimeout(r, 200));

            // 获取 Session
            const sessionRes = await fetch('/api/auth/session');
            const sessionData = await sessionRes.json();
            const roles = sessionData?.user?.roles || [];
            
            // ★ 如果 roles 为空，可能是 session 还没同步好，强制去 Dashboard
            if (roles.length === 0) {
                 console.warn("Session 未及时同步，尝试强制跳转");
                 // 默认尝试跳总部的，或者根据邮箱猜测（不推荐），这里直接刷新让 middleware 处理
                 router.push('/tenant/dashboard'); 
            } else {
                 const target = getRedirectPath(roles);
                 console.log(`登录成功 [${roles}], 跳转 -> ${target}`);
                 router.push(target);
            }
            
            router.refresh();

        } catch (err) {
            setError('网络错误');
            setIsLoading(false);
        }
    };

    // ... (渲染部分保持不变) ...
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
             <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-8">
                 <h2 className="text-2xl font-bold text-center mb-6">EduSaaS 登录</h2>
                 {error && <div className="text-red-500 text-sm mb-4 text-center">{error}</div>}
                 <form onSubmit={handleSubmit} className="space-y-4">
                     <input className="w-full p-3 border rounded" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="邮箱" required/>
                     <input className="w-full p-3 border rounded" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="密码" required/>
                     <button disabled={isLoading} className="w-full bg-indigo-600 text-white p-3 rounded font-bold">
                         {isLoading ? "登录中..." : "登录"}
                     </button>
                 </form>
             </div>
        </div>
    );
}