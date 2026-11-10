import * as React from "react";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/lib/cn";

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
  description,
  error,
  isSelected = false,
  onFieldClick,
  children,
  className,
}: FormFieldWrapperProps) {
  const handleClick = React.useCallback(() => {
    onFieldClick?.(id);
  }, [id, onFieldClick]);

  return (
    <div
      data-field-id={id}
      onClick={handleClick}
      className={cn(
        "group relative flex flex-col gap-1.5 rounded-lg border border-transparent p-3 transition-colors",
        isSelected && "border-primary/50 bg-primary/5 ring-primary/20 ring-2",
        onFieldClick && "hover:border-border hover:bg-muted/40 cursor-pointer",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
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
