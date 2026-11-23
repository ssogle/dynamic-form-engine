import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/shared/ui/sonner";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AI Dynamic Form Engine",
    template: "%s | AI Dynamic Form Engine",
  },
  description:
    "자연어 기반 관계형 도메인 폼 빌더, 멀티모달 비정형 데이터 정제 런타임 및 결정론적 데이터 분석 엔진",
  openGraph: {
    title: "AI Dynamic Form Engine",
    description:
      "자연어 기반 관계형 도메인 폼 빌더, 멀티모달 비정형 데이터 정제 런타임 및 결정론적 데이터 분석 엔진",
    type: "website",
    locale: "ko_KR",
    siteName: "AI Dynamic Form Engine",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Dynamic Form Engine",
    description:
      "자연어 기반 관계형 도메인 폼 빌더, 멀티모달 비정형 데이터 정제 런타임 및 결정론적 데이터 분석 엔진",
  },
};

/**
 * 애플리케이션 전역 루트 레이아웃
 *
 * 전역 폰트, 테마/쿼리 프로바이더, 토스트 알림 및 Vercel Web Analytics 방문자 추적 스크립트를 마운트합니다.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
        <Toaster position="bottom-right" richColors />
        {/* Vercel Web Analytics: 프로덕션 환경 방문자 및 페이지뷰 자동 집계 */}
        <Analytics />
      </body>
    </html>
  );
}
