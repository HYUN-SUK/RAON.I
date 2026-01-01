import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import LoginRequestDialog from "@/components/auth/LoginRequestDialog";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RAON.I",
  description: "Forest-based Human-Centric Playground",
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
      </body>
    </html>
  );
}
