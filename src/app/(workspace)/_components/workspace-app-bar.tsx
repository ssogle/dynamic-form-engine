"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FileText, Home, Settings, Wrench, type LucideIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/shared/ui/popover";
import { Separator } from "@/shared/ui/separator";
import { cn } from "@/shared/lib/cn";

/**
 * 작업 공간 앱 식별자 타입
 */
export type WorkspaceAppId = "builder" | "consumer" | "analyst";

/**
 * 작업 공간 앱 전환 바의 개별 앱 항목 메타데이터
 */
export interface WorkspaceAppItem {
  readonly id: WorkspaceAppId;
  readonly label: string;
  readonly englishLabel: string;
  readonly href: string;
  readonly matchPrefix: string;
  readonly icon: LucideIcon;
}

/**
 * 글로벌 앱 바에 노출되는 작업 공간 앱 목록 (단일 진실 원천)
 */
const WORKSPACE_APPS: readonly WorkspaceAppItem[] = [
  {
    id: "builder",
    label: "빌더",
    englishLabel: "Builder",
    href: "/builder/forms",
    matchPrefix: "/builder",
    icon: Wrench,
  },
  {
    id: "consumer",
    label: "컨슈머",
    englishLabel: "Consumer",
    href: "/consumer",
    matchPrefix: "/consumer",
    icon: FileText,
  },
  {
    id: "analyst",
    label: "분석가",
    englishLabel: "Analyst",
    href: "/analyst/views",
    matchPrefix: "/analyst",
    icon: BarChart3,
  },
];

/**
 * 현재 URL 경로가 특정 작업 공간 앱에 속하는지 판별합니다.
 */
function isWorkspaceAppActive(pathname: string, matchPrefix: string): boolean {
  return pathname === matchPrefix || pathname.startsWith(`${matchPrefix}/`);
}

/**
 * 작업 공간 최상위 글로벌 앱 전환 바 (WorkspaceAppBar)
 *
 * 좌측 AI Navigator 패널과 우측 작업 영역 전체의 상위 레이어에 배치되어,
 * 빌더 / 컨슈머 / 분석가 앱 간 전환과 루트 게이트웨이(/) 복귀를 담당합니다.
 */
export function WorkspaceAppBar() {
  const pathname = usePathname();

  return (
    <header
      aria-label="전역 작업 공간 앱 전환 바"
      className="border-border/80 bg-muted/40 flex h-12 shrink-0 items-center justify-between border-b px-4"
    >
      <div className="flex items-center gap-3">
        {/* 루트 게이트웨이(/) 복귀 아이콘 버튼 */}
        <Button
          asChild
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <Link href="/" aria-label="처음 화면으로 이동">
            <Home className="size-4" />
          </Link>
        </Button>

        {/* 홈(/)과 3개 독립 앱(빌더 / 컨슈머 / 분석가) 사이마다 수직 구분선을 배치하는 스위처 */}
        {WORKSPACE_APPS.map((app) => {
          const Icon = app.icon;
          const isActive = isWorkspaceAppActive(pathname, app.matchPrefix);

          return (
            <React.Fragment key={app.id}>
              {/* shadcn Separator 기본값(data-vertical:self-stretch)을 덮어써 수직 중앙 정렬을 보장 */}
              <Separator orientation="vertical" className="h-4 data-vertical:self-center" />

              <Button
                asChild
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 gap-1.5 rounded-md px-2.5 text-xs leading-none transition-all",
                  isActive
                    ? "bg-background text-foreground hover:bg-background font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground font-medium"
                )}
              >
                <Link href={app.href} aria-current={isActive ? "page" : undefined}>
                  <Icon className="size-3.5 shrink-0" />
                  <span className="leading-none">{app.label}</span>
                  <span className="text-muted-foreground hidden text-[10px] leading-none font-normal md:inline">
                    {app.englishLabel}
                  </span>
                </Link>
              </Button>
            </React.Fragment>
          );
        })}
      </div>

      {/* 우측 작업 공간 설정 버튼 및 임시 안내 팝오버 */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="설정"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <Settings className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-3">
          <PopoverHeader>
            <PopoverTitle className="text-sm">설정</PopoverTitle>
            <PopoverDescription className="text-xs">
              작업 공간 설정 항목이 추후 추가될 예정입니다.
            </PopoverDescription>
          </PopoverHeader>
        </PopoverContent>
      </Popover>
    </header>
  );
}
