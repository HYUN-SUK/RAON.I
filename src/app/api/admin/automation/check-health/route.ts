import { performHealthCheck } from '@/lib/api-health';

export async function POST(request: Request) {
  try {
    // 1. 단순 세션 체크 (실제로는 어드민 권한 체크 필요)
    const authHeader = request.headers.get('authorization');
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    
    if (!isCron && request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // 2. 네이티브 모듈 직접 호출 (Serverless Compatible)
    try {
      const results = await performHealthCheck();
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'API Health check completed (Native Execution).',
        data: results 
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (checkError: any) {
      console.error('Health Check Execution Error:', checkError);
      return new Response(JSON.stringify({ 
        error: 'Failed to perform health check', 
        details: checkError.message 
      }), { status: 500 });
    }

  } catch (error: any) {
    console.error('API Route Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500 });
  }
}
