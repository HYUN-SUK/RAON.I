import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // 1. 트래픽 과다 소진 악성/무차별 데이터 수집 봇 전면 차단
        userAgent: [
          'Bytespider', // 틱톡/바이트댄스 무차별 긁어가기 (1위)
          'PetalBot',   // 화웨이 스크레이퍼
          'AhrefsBot',  // 해외 유료 SEO 스크레이퍼
          'SemrushBot',
          'MJ12bot',
          'DotBot',
          'BLEXBot',
          'CCBot',      // Common Crawl 대량 데이터 수집기
          'cohere-ai',  // 코히어 단순 학습 크롤러
          'ClaudeBot',  // 앤트로픽 대량 학습 크롤러 (실시간 검색은 아래 Claude-SearchBot으로 허용)
          'YandexBot',
        ],
        disallow: ['/'],
      },
      {
        // 2. 포털 검색 엔진 & AI 실시간 검색/추천 봇 & SNS 미리보기 100% 허용
        // (손님이 ChatGPT, Claude, Gemini, 네이버, 구글, 퍼플렉시티에 라온아이를 물어봤을 때 정확히 추천하도록 보장)
        userAgent: [
          'Googlebot',            // 구글 검색 & 구글 제미나이(Gemini) AI 검색
          'Yeti',                 // 네이버 검색 & 네이버 클로바X(Clova) AI 추천
          'Daumoa',               // 다음/카카오 검색
          'OAI-SearchBot',        // OpenAI SearchGPT & 챗GPT 실시간 검색 봇
          'ChatGPT-User',         // 챗GPT 사용자가 링크 요청 시 실시간 탐색 봇
          'Claude-SearchBot',     // 앤트로픽 클로드(Claude) 공식 실시간 검색/추천 봇
          'Claude-User',          // 클로드 사용자가 라온아이 정보/링크 질문 시 방문 봇
          'PerplexityBot',        // 전 세계 1위 AI 검색엔진 퍼플렉시티
          'kakaotalk-scrap',      // 카카오톡 채팅방 링크 공유 시 썸네일/미리보기
          'facebookexternalhit',  // SNS 링크 미리보기
        ],
        allow: ['/'],
        disallow: ['/api/', '/admin/', '/_next/', '/auth/'],
      },
      {
        // 3. 일반 검색 봇: 공개 페이지만 허용하고 내부 API/시스템 번들 수집 차단
        userAgent: '*',
        allow: ['/'],
        disallow: ['/api/', '/admin/', '/_next/', '/auth/'],
      },
    ],
  };
}
