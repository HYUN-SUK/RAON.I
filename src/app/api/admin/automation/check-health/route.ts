import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execPromise = promisify(exec);

export async function POST(request: Request) {
  try {
    // 1. 단순 세션 체크 (실제로는 어드민 권한 체크 필요)
    const authHeader = request.headers.get('authorization');
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    
    if (!isCron && request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Server Configuration Error' }), { status: 500 });
    }

    // 2. 스크립트 실행 (절대 경로 사용)
    const scriptPath = path.join(process.cwd(), 'scripts', 'check_api_health.mjs');
    
    try {
      // 스크립트를 실행하고 stdout을 캡처합니다.
      const { stdout, stderr } = await execPromise(`node ${scriptPath}`);
      
      if (stderr) {
        console.warn('Script stderr:', stderr);
      }

      // stdout에서 JSON 결과 추출
      const match = stdout.match(/JSON_RESULT_START\n([\s\S]*?)\nJSON_RESULT_END/);
      let apiStatusData = null;

      if (match && match[1]) {
        try {
          apiStatusData = JSON.parse(match[1]);
        } catch (parseError) {
          console.error('Failed to parse script output JSON:', parseError);
        }
      }

      // DB 저장이 성공했는지와 별개로, 파싱된 결과가 있다면 즉시 반환
      if (apiStatusData) {
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'API Health check completed (Direct Response).',
          data: apiStatusData 
        }), { status: 200 });
      }

      // 만약 파싱에 실패했다면 기존처럼 DB에서 최신 로그를 가져오는 차선책 시도
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data, error } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('job_name', 'API_HEALTH_CHECK')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'API Health check completed.',
        data: data.api_status 
      }), { status: 200 });

    } catch (execError: any) {
      console.error('Exec error:', execError);
      return new Response(JSON.stringify({ error: 'Failed to run health check script', details: execError.message }), { status: 500 });
    }

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500 });
  }
}
