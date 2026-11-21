"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  BarChart3,
  FileText,
  Home,
  Monitor,
  Moon,
  PanelLeft,
  PanelRight,
  Settings,
  Sun,
  Wrench,
  type LucideIcon,
} from "lucide-react";
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
import {
  DEFAULT_NAVIGATOR_DOCK_SIDE,
  readSavedNavigatorDockSide,
  saveNavigatorDockSide,
  subscribeNavigatorDockSide,
  type NavigatorDockSide,
} from "@/shared/lib/navigator-focus";

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
 * 설정 팝오버에서 제공하는 화면 색상 모드 옵션 목록
 */
const THEME_OPTIONS: ReadonlyArray<{
  readonly value: "light" | "dark" | "system";
  readonly label: string;
  readonly icon: LucideIcon;
}> = [
  { value: "light", label: "라이트", icon: Sun },
  { value: "dark", label: "다크", icon: Moon },
  { value: "system", label: "시스템", icon: Monitor },
];

/**
 * 설정 팝오버에서 제공하는 AI Navigator 패널 도킹 위치 옵션 목록
 */
const DOCK_SIDE_OPTIONS: ReadonlyArray<{
  readonly value: NavigatorDockSide;
  readonly label: string;
  readonly icon: LucideIcon;
}> = [
  { value: "left", label: "왼쪽", icon: PanelLeft },
  { value: "right", label: "오른쪽", icon: PanelRight },
];

/**
 * 현재 URL 경로가 특정 작업 공간 앱에 속하는지 판별합니다.
 */
function isWorkspaceAppActive(pathname: string, matchPrefix: string): boolean {
  return pathname === matchPrefix || pathname.startsWith(`${matchPrefix}/`);
}

const subscribeEmpty = () => () => {};

/**
 * 서비스 전역 최상위 글로벌 앱 전환 바 (WorkspaceAppBar)
 *
 * 홈 랜딩(/) 및 빌더·컨슈머·분석가 작업 공간 최상단에 배치되어
 * 앱 간 전환, 루트 게이트웨이 복귀, 화면 색상 모드(라이트/다크/시스템) 설정을 담당합니다.
 */
export function WorkspaceAppBar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    subscribeEmpty,
    () => true,
    () => false
  );
  const dockSide = React.useSyncExternalStore(
    subscribeNavigatorDockSide,
    readSavedNavigatorDockSide,
    () => DEFAULT_NAVIGATOR_DOCK_SIDE
  );

  const isHomeActive = pathname === "/";
  const activeTheme = mounted ? (theme ?? "system") : undefined;

  return (
    <header
      aria-label="전역 작업 공간 앱 전환 바"
      className="border-border/80 bg-muted/50 relative z-20 flex h-12 shrink-0 items-center justify-between border-b px-4 backdrop-blur-sm"
    >
      <div className="flex items-center gap-3">
        {/* 루트 게이트웨이(/) 복귀 아이콘 버튼 */}
        <Button
          asChild
          variant="ghost"
          size="icon-sm"
          className={cn(
            "shrink-0 transition-all",
            isHomeActive
              ? "bg-background text-foreground hover:bg-background shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Link
            href="/"
            aria-label="처음 화면으로 이동"
            aria-current={isHomeActive ? "page" : undefined}
          >
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

      {/* 우측 작업 공간 설정 버튼 및 테마 전환 팝오버 */}
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
        <PopoverContent align="end" className="w-64 space-y-3 p-3.5">
          <PopoverHeader>
            <PopoverTitle className="text-sm font-semibold">환경 설정</PopoverTitle>
            <PopoverDescription className="text-xs">
              화면 테마와 AI Navigator 패널 위치를 즉시 설정합니다.
            </PopoverDescription>
          </PopoverHeader>

          <div className="space-y-1.5">
            <span className="text-muted-foreground block text-[11px] font-medium">화면 테마</span>
            <div
              role="radiogroup"
              aria-label="화면 테마 선택"
              className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-1"
            >
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = activeTheme === option.value;
                return (
                  <Button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    variant="ghost"
                    size="xs"
                    onClick={() => setTheme(option.value)}
                    className={cn(
                      "h-7 gap-1 rounded-md px-2 text-[11px] font-medium transition-all",
                      isSelected
                        ? "bg-background text-foreground hover:bg-background shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    <span>{option.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-muted-foreground block text-[11px] font-medium">
              AI 채팅 패널 위치
            </span>
            <div
              role="radiogroup"
              aria-label="AI 채팅 패널 위치 선택"
              className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1"
            >
              {DOCK_SIDE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = dockSide === option.value;
                return (
                  <Button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    variant="ghost"
                    size="xs"
                    onClick={() => saveNavigatorDockSide(option.value)}
                    className={cn(
                      "h-7 gap-1.5 rounded-md px-2 text-[11px] font-medium transition-all",
                      isSelected
                        ? "bg-background text-foreground hover:bg-background shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    <span>{option.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </header>
  );
}
