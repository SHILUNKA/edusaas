// src/lib/config.ts

// 1. 优先读取环境变量 (NEXT_PUBLIC_API_URL)
// 2. 如果没读到，默认回退到 localhost (仅本机可用)
// 3. 关键修复: 确保不会返回 undefined
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// 打印调试信息 (方便在浏览器控制台 F12 查看)
if (typeof window !== 'undefined') {
    console.log(`🌐 前端 API 配置地址: ${API_BASE_URL}`);
}