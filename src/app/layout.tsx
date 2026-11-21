import type { Metadata } from "next";
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
      </body>
    </html>
  );
}
