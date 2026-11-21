import * as React from "react";
import { cn } from "@/shared/lib/cn";
import { Badge } from "./badge";

export interface PublishStatusBadgeProps {
  /** 공식 발행 여부 (`true`: 발행됨, `false`: 초안) */
  readonly isPublished: boolean;
  /** 추가 스타일 클래스 */
  readonly className?: string | undefined;
}

/**
 * 폼 및 분석 뷰 문서의 발행 상태를 단일 규격으로 표시하는 공통 상태 배지입니다.
 *
 * - 발행됨: 에메랄드 시맨틱 배지
 * - 초안: 보조(secondary) 중립 배지
 */
export function PublishStatusBadge({ isPublished, className }: PublishStatusBadgeProps) {
  if (isPublished) {
    return (
      <Badge
        variant="default"
        className={cn(
          "shrink-0 border-transparent bg-emerald-600 text-[11px] text-white hover:bg-emerald-600 dark:bg-emerald-600",
          className
        )}
      >
        발행됨
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className={cn("shrink-0 text-[11px]", className)}>
      초안
    </Badge>
  );
}
