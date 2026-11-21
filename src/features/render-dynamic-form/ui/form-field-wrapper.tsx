import * as React from "react";
import { Sparkles } from "lucide-react";
import { PrimaryFieldBadge } from "@/entities/form";
import { Badge } from "@/shared/ui/badge";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/lib/cn";

const INTERACTIVE_CONTROL_SELECTOR =
  'input, textarea, select, button, a, [role="combobox"], [role="checkbox"], [role="radio"], [role="switch"], label';

/**
 * 폼 필드 래퍼 프로퍼티 인터페이스
 * exactOptionalPropertyTypes 설정에 대응하기 위해
 * 선택적 속성에는 명시적으로 `| undefined`를 유니온으로 허용합니다.
 */
export interface FormFieldWrapperProps {
  /** 필드 고유 식별자 (Click-to-Mention 타깃팅 속성으로 주입) */
  id: string;

  /** 필드 라벨 텍스트 */
  label: string;

  /** 필수 입력 여부 */
  required?: boolean | undefined;

  /** 도메인의 대표 식별 필드 여부 */
  isPrimary?: boolean | undefined;

  /** 빌더 프리뷰 모드 등에서 라벨 옆에 노출할 필드 타입 한글 라벨 */
  typeLabel?: string | undefined;

  /** 필드 하단 설명/도움말 문구 */
  description?: string | undefined;

  /** 유효성 검사 에러 메시지 */
  error?: string | undefined;

  /** 네비게이터 대화 패널과 연동된 현재 선택 필드 여부 */
  isSelected?: boolean | undefined;

  /** 필드 영역 클릭 시 핸들러 (네비게이터 대화창에 필드 멘션 트리거용) */
  onFieldClick?: ((fieldId: string) => void) | undefined;

  /** 실제 인풋 컨트롤 노드 */
  children: React.ReactNode;

  /** 외부 커스텀 스타일 클래스 */
  className?: string | undefined;
}

/**
 * 폼 필드 공통 래퍼 컴포넌트
 *
 * 모든 입력 컴포넌트(text, textarea, number, select 등)의 상단 라벨, 필수(*) 마크,
 * 하단 설명 문구, 유효성 검증 에러 피드백을 단일 규격으로 래핑합니다.
 * 또한 data-field-id 속성을 부여하여 AI 네비게이터와의 상호작용 지점을 제공합니다.
 */
export function FormFieldWrapper({
  id,
  label,
  required = false,
  isPrimary = false,
  typeLabel,
  description,
  error,
  isSelected = false,
  onFieldClick,
  children,
  className,
}: FormFieldWrapperProps) {
  // 실제 입력 컨트롤 조작 중에는 AI 채팅 포커스를 가로채지 않고, 카드 빈 영역/헤더/수정 버튼 클릭만 연결합니다.
  const handleContainerClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onFieldClick) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest(INTERACTIVE_CONTROL_SELECTOR)) {
        return;
      }
      onFieldClick(id);
    },
    [id, onFieldClick]
  );

  return (
    <div
      data-field-id={id}
      onClick={handleContainerClick}
      className={cn(
        "group relative flex flex-col gap-1.5 rounded-lg border border-transparent p-3 transition-colors",
        isPrimary && "border-primary/30 bg-primary/[0.02]",
        isSelected && "border-primary/50 bg-primary/5 ring-primary/20 ring-2",
        onFieldClick && "hover:border-border hover:bg-muted/40",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Label
            htmlFor={id}
            className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
            {required && (
              <span className="text-destructive ml-1" aria-label="필수 입력">
                *
              </span>
            )}
          </Label>
          {isPrimary && <PrimaryFieldBadge />}
          {typeLabel && (
            <Badge variant="outline" className="text-muted-foreground px-1.5 py-0 text-[10px]">
              {typeLabel}
            </Badge>
          )}
        </div>

        {onFieldClick && (
          <button
            type="button"
            onClick={() => onFieldClick(id)}
            className="text-muted-foreground hover:text-primary hover:bg-primary/10 inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium opacity-75 transition-all group-hover:opacity-100"
            title="클릭하여 AI Navigator에게 이 필드 수정을 요청합니다"
          >
            <Sparkles className="text-primary size-3" />
            AI로 수정
          </button>
        )}
      </div>

      <div className="mt-1">{children}</div>

      {description && !error && (
        <p className="text-muted-foreground text-xs/normal">{description}</p>
      )}

      {error && (
        <p className="text-destructive text-xs/normal font-medium" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
