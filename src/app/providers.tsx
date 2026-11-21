"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";

/**
 * 전역 클라이언트 Provider 래퍼 컴포넌트
 *
 * next-themes ThemeProvider와 TanStack Query QueryClientProvider를 전역에 주입합니다.
 * 컴포넌트 라이프사이클 동안 단일 QueryClient 인스턴스를 유지합니다.
 */
export function Providers({ children }: { readonly children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60, // 1분간 캐시 유지
            retry: 1, // 실패 시 1회 재시도
          },
        },
      })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
