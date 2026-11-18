"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavigatorShell } from "@/widgets/navigator-shell";
import { cn } from "@/shared/lib/cn";

/**
 * 빌더 작업 공간 레이아웃
 *
 * 최상위 WorkspaceLayout의 글로벌 앱 바 하단 영역(h-full)을 채우며,
 * 좌측: 상시 상주하는 Builder AI Navigator 패널
 * 우측 상단: 빌더 내부 네비게이션 탭 (폼 목록)
 * 우측 본문: 하위 작업 화면 캔버스
 */
export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isFormsActive = pathname.startsWith("/builder/forms");

  return (
    <div className="bg-background flex h-full w-full overflow-hidden">
      {/* 좌측 상주형 AI Navigator 관제탑 패널 */}
      <div className="border-border/80 h-full w-80 shrink-0 border-r lg:w-96">
        <NavigatorShell mode="builder" />
      </div>

      {/* 우측 메인 영역 */}
      <div className="bg-muted/10 flex flex-1 flex-col overflow-hidden">
        {/* 빌더 상단 내부 네비게이션 탭 헤더 */}
        <header className="border-border/60 bg-background/80 flex h-14 shrink-0 items-center justify-between border-b px-6 backdrop-blur-sm">
          <nav className="flex items-center gap-1">
            <Link
              href="/builder/forms"
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isFormsActive
                  ? "bg-secondary text-secondary-foreground font-semibold shadow-2xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              폼 목록
            </Link>
          </nav>
        </header>

        {/* 우측 본문 작업 화면 */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto min-h-full px-4 py-8 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
