import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RAON.I",
  description: "Forest-based Human-Centric Playground",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${inter.className} antialiased`}>
        <div className="w-full max-w-[430px] bg-surface-1 min-h-screen relative shadow-2xl flex flex-col mx-auto overflow-hidden">
          <main className="flex-1 pb-[80px] overflow-y-auto scrollbar-hide">
            {children}
          </main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
