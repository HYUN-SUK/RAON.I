import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path');
    const orgCode = searchParams.get('orgCode');

    if (!path || !orgCode) {
      return new NextResponse('Missing parameters', { status: 400 });
    }

    const targetUrl = `https://file.localdata.go.kr/file/download/${path}/info?orgCode=${orgCode}`;
    console.log(`[LocalData Proxy] Requesting target: ${targetUrl}`);

    // node 내장 fetch API 사용 (Node 18+)
    // 3분 타임아웃 처리를 위한 AbortController 설정
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[LocalData Proxy] Target server returned status: ${response.status}`);
      return new NextResponse(`Proxy target error: HTTP ${response.status}`, { status: response.status });
    }

    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
        'Content-Disposition': response.headers.get('content-disposition') || `attachment; filename="${path}.csv"`,
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error: any) {
    console.error('[LocalData Proxy Error]', error);
    return new NextResponse(`Proxy internal error: ${error.message}`, { status: 500 });
  }
}
