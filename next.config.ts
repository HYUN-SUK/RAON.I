import type { NextConfig } from "next";

interface ExtendedNextConfig extends NextConfig {
  eslint?: {
    ignoreDuringBuilds?: boolean;
  };
}

const nextConfig: ExtendedNextConfig = {
  images: {
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
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
