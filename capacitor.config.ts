import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'kr.co.raoni.app',
  appName: '라온아이',
  webDir: 'public',
  server: {
    // 실시간 Vercel 배포 자동 반영: 앱 재배포 없이 웹 갱신 시 실시간 동기화
    url: 'https://raon-i.co.kr',
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: [
      '*.supabase.co',
      '*.kakao.com',
      '*.kakaocdn.net',
      '*.daum.net',
      '*.daumcdn.net',
      'accounts.google.com',
      '*.google.com',
      '*.gstatic.com',
      '*.googleusercontent.com'
    ]
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  },
  android: {
    allowMixedContent: true,
    captureInput: false,
    webContentsDebuggingEnabled: false
  }
};

export default config;
