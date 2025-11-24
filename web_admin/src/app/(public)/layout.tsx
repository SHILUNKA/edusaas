/*
 * 公共页面布局 (用于登录页、忘记密码页等)
 * 路径: src/app/(public)/layout.tsx
 */
import React from 'react';

export default function PublicLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        // 我们用 flex 布局让表单在屏幕上 "垂直和水平居中"
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-md">
                {children} 
            </div>
        </div>
    );
}