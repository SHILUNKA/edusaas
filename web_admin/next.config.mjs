// web_admin/next.config.mjs
// (★ 关键修复: 我们使用 JSDoc (注释) 来代替 "import type")

/** @type {import('next').NextConfig} */
const nextConfig = {
  // (★ 关键) 确保 React 18 / Next 14 的严格模式是开启的
  reactStrictMode: true,
  
  // (★ 可选) 如果您的 Dockerfile 需要 'standalone' 输出
  // output: 'standalone', 
};

export default nextConfig;