import * as React from "react";
import { KeyRound } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/cn";

export interface PrimaryFieldBadgeProps {
  /** 추가 스타일 클래스 */
  className?: string | undefined;
}

/**
 * 데이터 도메인 폼의 대표 식별 필드(primaryFieldId)를 UI 전반에서 일관되게 표시하는 배지 컴포넌트입니다.
 * 폼 빌더 미리보기, 입력 폼, 목록 테이블 헤더, 단건 상세 카드에서 공통으로 사용합니다.
 */
export function PrimaryFieldBadge({ className }: PrimaryFieldBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "border-primary/30 bg-primary/10 text-primary gap-1 border px-1.5 py-0 text-[10px] font-semibold",
        className
      )}
    >
      <KeyRound className="size-2.5" aria-hidden="true" />
      대표
    </Badge>
  );
}
