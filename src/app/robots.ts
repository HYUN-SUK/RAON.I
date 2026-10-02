import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // 트래픽 과다 소진 악성/수집 봇 전면 차단
        userAgent: [
          'Bytespider',
          'PetalBot',
          'AhrefsBot',
          'SemrushBot',
          'MJ12bot',
          'DotBot',
          'BLEXBot',
          'GPTBot',
          'ClaudeBot',
          'CCBot',
          'cohere-ai',
          'YandexBot',
        ],
        disallow: ['/'],
      },
      {
        // 국내 주요 검색 엔진 및 SNS 미리보기 정상 허용
        userAgent: [
          'Googlebot',
          'Yeti',
          'Daumoa',
          'kakaotalk-scrap',
          'facebookexternalhit',
        ],
        allow: ['/'],
        disallow: ['/api/', '/admin/', '/_next/', '/auth/'],
      },
      {
        // 일반 검색 봇: 공개 페이지만 허용하고 내부 API/번들 수집 차단
        userAgent: '*',
        allow: ['/'],
        disallow: ['/api/', '/admin/', '/_next/', '/auth/'],
      },
    ],
  };
}
