import type { NextConfig } from "next";

interface ExtendedNextConfig extends NextConfig {
  eslint?: {
    ignoreDuringBuilds?: boolean;
  };
}

const nextConfig: ExtendedNextConfig = {
  images: {
    // 30일(2,592,000초) 캐싱으로 동일 이미지 반복 변환 및 불필요한 Vercel 캐시 쓰기(64K) 차단
    minimumCacheTTL: 2592000,
    // 고효율 차세대 포맷(AVIF, WebP) 압축 지원으로 이미지 대역폭 대폭 절감
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'khqiqwtoyvesxahsjukk.supabase.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.kakaocdn.net',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '*.kakaocdn.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.pstatic.net',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        // 정적 아이콘 및 UI 이미지 브라우저 1년 장기 캐시 (불필요한 반복 CDN 요청 원천 방지)
        // ※ 서비스 워커(firebase-messaging-sw.js) 및 manifest.json은 제외하여 PWA/푸시 안전 보장
        source: '/(icons|images)/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
