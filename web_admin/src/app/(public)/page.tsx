/*
 * 根页面 (/)
 * 路径: src/app/(public)/page.tsx
 * 作用: 自动重定向到登录页
 */
import { redirect } from 'next/navigation';

export default function RootPage() {
    // 立即重定向到 /login
    redirect('/login');
    
    // (Next.js 会处理重定向, 这里可以返回 null)
    return null; 
}