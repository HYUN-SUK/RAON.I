import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter, Nanum_Pen_Script, Nanum_Myeongjo } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import LoginRequestDialog from "@/components/auth/LoginRequestDialog";
import ServiceWorkerRegister from "@/components/pwa/ServiceWorkerRegister";
import DeepLinkHandler from "@/components/pwa/DeepLinkHandler";
import DiagnosticSensorActivator from "@/components/common/DiagnosticSensorActivator";
import SystemThemeColorSync from "@/components/common/SystemThemeColorSync";

const inter = Inter({ subsets: ["latin"] });
const nanumPen = Nanum_Pen_Script({ weight: "400", subsets: ["latin"], variable: "--font-nanum-pen" });
const nanumMyeongjo = Nanum_Myeongjo({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-nanum-myeongjo" });

export const metadata: Metadata = {
  title: "라온아이 | 스마트 여행 수첩",
  description: "라온아이 캠핑장 예약과 똑똑한 여행수첩을 한 번에! 2배 사이트와 개별 욕실의 프리미엄 캠핑부터 나의 모든 여행 계획·기록까지 함께하세요.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "라온아이",
  },
  icons: {
    icon: "/icons/logo-original.jpg",
    apple: "/icons/logo-original.jpg",
  },
  openGraph: {
    title: "라온아이 | 스마트 여행 수첩",
    description: "라온아이 캠핑장 예약과 똑똑한 여행수첩을 한 번에! 2배 사이트와 개별 욕실의 프리미엄 캠핑부터 나의 모든 여행 계획·기록까지 함께하세요.",
    type: "website",
    locale: "ko_KR",
  },
  verification: {
    google: "HWRUdDrGbR0obOn0gVQdzQFmaZI4h0-JM1w95fGHea8",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#FFFFFF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#FFFFFF" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  function syncSystemTheme() {
                    var isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                    var color = isDark ? '#18181B' : '#FFFFFF';
                    var metas = document.querySelectorAll('meta[name="theme-color"]');
                    if (metas.length > 0) {
                      metas.forEach(function(m) { m.setAttribute('content', color); });
                    } else {
                      var m = document.createElement('meta');
                      m.name = 'theme-color';
                      m.content = color;
                      document.head.appendChild(m);
                    }
                  }
                  syncSystemTheme();
                  if (window.matchMedia) {
                    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncSystemTheme);
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.className} ${nanumPen.variable} ${nanumMyeongjo.variable} antialiased`} suppressHydrationWarning>
        <SystemThemeColorSync />
        <link href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700&family=Nanum+Pen+Script&display=swap" rel="stylesheet" />
        {children}
        <Toaster position="top-center" />
        <LoginRequestDialog />
        <Suspense fallback={null}>
          <DeepLinkHandler />
        </Suspense>
        <ServiceWorkerRegister />
        <DiagnosticSensorActivator />
      </body>
    </html>
  );
}
