"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Monitor } from "lucide-react";
import type { NavigatorMode } from "@/features/execute-navigator-action";
import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/ui/card";
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
    <>
      {/* 1024px 미만 좁은 뷰포트(모바일/소형 태블릿) 전용 데스크톱 안내 하드 가드 */}
      <div className="bg-muted/20 flex h-full w-full items-center justify-center p-6 lg:hidden">
        <Card className="border-border/70 w-full max-w-md text-center shadow-sm">
          <CardHeader className="items-center space-y-3 pb-4">
            <div className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-full">
              <Monitor className="size-5" />
            </div>
            <CardTitle className="text-lg font-semibold">
              데스크톱 환경(1024px 이상) 전용 워크스페이스
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs/relaxed">
              좌우 분할 AI Navigator, 라이브 폼 캔버스, 가상화 데이터 테이블 및 3D 관계 그래프의
              원활한 조작을 위해 가로 1024px 이상의 데스크톱 화면에서 이용해 주세요.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center pt-2">
            <Button asChild size="sm">
              <Link href="/">홈으로 돌아가기</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* 데스크톱(1024px 이상) 전용 좌우 분할 워크스페이스 */}
      <div className="bg-background hidden h-full w-full overflow-hidden lg:flex">
        {/* 좌측 상주형 AI Navigator 관제탑 패널 */}
        <div className="border-border/80 h-full w-80 shrink-0 border-r lg:w-96">
          <NavigatorShell mode={mode} />
        </div>

        {/* 우측 본문 작업 화면 (상단 앱 바 아래 1024px 통일 캔버스) */}
        <main className="bg-muted/10 min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto min-h-full w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
