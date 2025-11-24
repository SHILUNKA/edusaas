/*
 * 路径: src/app/layout.tsx
 * (V2 - 已添加 Next-Auth 的 SessionProvider)
 */
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from './providers'; // (★ 关键) 导入我们的 Provider

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "科普SaaS平台",
    description: "SaaS 平台",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="zh-CN">
            <body className={inter.className}>
                {/* (★ 关键修改 ★) 
                    我们必须在这里使用 Providers, 
                    以便 Next-Auth 的 Session 可以被所有客户端组件共享 
                */}
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    );
}