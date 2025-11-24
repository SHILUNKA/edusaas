import { NextRequest, NextResponse } from 'next/server';

// 直接在文件中定义后端配置
const BACKEND_CONFIG = {
  baseUrl: 'http://edusaas_core_api:8000',
} as const;

export async function GET(request: NextRequest) {
  const testUrls = [
    { name: 'localhost:8000', url: 'http://localhost:8000/health/db' },
    { name: 'core_api:8000', url: 'http://edusaas_core_api:8000/health/db' },
    { name: 'config_core_api', url: `${BACKEND_CONFIG.baseUrl}/health/db` },
    { name: '127.0.0.1:8000', url: 'http://127.0.0.1:8000/health/db' },
  ];

  const results = [];

  for (const test of testUrls) {
    try {
      const start = Date.now();
      const response = await fetch(test.url, { 
        signal: AbortSignal.timeout(3000) 
      });
      const latency = Date.now() - start;
      
      let responseData = null;
      try {
        responseData = await response.json();
      } catch {
        responseData = { text: await response.text() };
      }
      
      results.push({
        name: test.name,
        url: test.url,
        status: response.status,
        ok: response.ok,
        latency: `${latency}ms`,
        error: null,
        data: responseData
      });
    } catch (error: any) {
      results.push({
        name: test.name,
        url: test.url,
        status: 'error',
        ok: false,
        latency: null,
        error: error.message,
        data: null
      });
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    backend_config: {
      baseUrl: BACKEND_CONFIG.baseUrl,
      using_service: BACKEND_CONFIG.baseUrl.includes('core_api') ? 'Docker服务名' : 'localhost'
    },
    network_check: results,
    summary: {
      total_tests: testUrls.length,
      successful: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      recommended_url: BACKEND_CONFIG.baseUrl
    }
  });
}