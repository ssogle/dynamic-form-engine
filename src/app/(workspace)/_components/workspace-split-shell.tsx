"use client";

import type { ReactNode } from "react";
import type { NavigatorMode } from "@/features/execute-navigator-action";
import { NavigatorShell } from "@/widgets/navigator-shell";

interface WorkspaceSplitShellProps {
  /** 현재 작업 공간 앱의 AI Navigator 동작 모드 */
  readonly mode: NavigatorMode;
  /** 우측 본문 작업 영역에 렌더링할 페이지 콘텐츠 */
  readonly children: ReactNode;
}

/**
 * 작업 공간 공통 좌우 분할 쉘 (WorkspaceSplitShell)
 *
 * 최상위 WorkspaceLayout의 글로벌 앱 바 하단(h-full)을 채우며,
 * 좌측 상주형 AI Navigator 패널과 우측 스크롤 가능한 메인 작업 캔버스로 구성됩니다.
 */
export function WorkspaceSplitShell({ mode, children }: WorkspaceSplitShellProps) {
  return (
    <div className="bg-background flex h-full w-full overflow-hidden">
      {/* 좌측 상주형 AI Navigator 관제탑 패널 */}
      <div className="border-border/80 h-full w-80 shrink-0 border-r lg:w-96">
        <NavigatorShell mode={mode} />
      </div>

      {/* 우측 본문 작업 화면 (상단 앱 바 아래 단일 캔버스) */}
      <main className="bg-muted/10 min-w-0 flex-1 overflow-y-auto">
        <div className="container mx-auto min-h-full px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
