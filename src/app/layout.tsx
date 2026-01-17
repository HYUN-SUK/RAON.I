import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import LoginRequestDialog from "@/components/auth/LoginRequestDialog";
import ServiceWorkerRegister from "@/components/pwa/ServiceWorkerRegister";
import DeepLinkHandler from "@/components/pwa/DeepLinkHandler";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "라온아이 | 예산군 오토캠핑장",
  description: "두가족도 넉넉한 2배사이트, 깨끗한 개별욕실. 라온아이에서 불편은 덜고, 추억은 쌓으세요.",
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
    title: "라온아이 | 예산군 오토캠핑장",
    description: "두가족도 넉넉한 2배사이트, 깨끗한 개별욕실. 라온아이에서 불편은 덜고, 추억은 쌓으세요.",
    type: "website",
    locale: "ko_KR",
  },
};

export const dynamic = 'force-dynamic';

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        {children}
        <Toaster position="top-center" />
        <LoginRequestDialog />
        <Suspense fallback={null}>
          <DeepLinkHandler />
        </Suspense>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
