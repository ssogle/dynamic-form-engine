import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";

export interface BackLinkProps {
  /** 이동할 상위 목록 또는 이전 화면 경로 */
  readonly href: string;
  /** 복귀 버튼에 표시할 레이블 (예: "폼 목록으로", "데이터 목록으로") */
  readonly label: string;
  /** 추가 Tailwind 클래스명 */
  readonly className?: string | undefined;
}

/**
 * 서브 페이지 상단 좌측에 배치하는 통일된 뒤로가기·목록 복귀 링크 컴포넌트
 *
 * 빌더·컨슈머·분석가의 모든 하위 화면에서 동일한 위치·크기·아이콘(`ArrowLeft`)·호버 대비를 유지합니다.
 */
export function BackLink({ href, label, className }: BackLinkProps) {
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className={cn(
        "text-muted-foreground hover:text-foreground -ml-2 h-8 gap-1.5 px-2 text-xs font-medium",
        className
      )}
    >
      <Link href={href}>
        <ArrowLeft className="size-3.5 shrink-0" />
        <span>{label}</span>
      </Link>
    </Button>
  );
}
