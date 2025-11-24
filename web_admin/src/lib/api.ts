// src/lib/api.ts
import { getServerSession } from "next-auth/next"; // (★ V4 导入)
import { authOptions } from "./authOptions"; // (★ V4 导入)

const API_URL = process.env.CORE_API_URL || "http://edusaas_core_api:8000/api/v1";

// (★ 这是一个 *仅限服务器端* 的 API 辅助函数 ★)
async function getApiInstance() {
  const session = await getServerSession(authOptions); // (★ V4 调用)
  const token = session?.user?.rawToken;

  if (!token) {
    throw new Error("API (server): Not authenticated");
  }
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  return {
    get: async <T>(endpoint: string): Promise<T> => {
      const url = `${API_URL}${endpoint}`;
      console.log(`(API Lib) Fetching: ${url}`);
      const res = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
      if (!res.ok) {
        console.error(`(API Lib) Error fetching ${url}: ${res.status} ${res.statusText}`);
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
      }
      return res.json() as T;
    },
  };
}
export const api = await getApiInstance();