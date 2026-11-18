"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { formatDateToYmd, formatYmdInputMask, parseYmdToDate } from "@/shared/lib/date";
import { cn } from "@/shared/lib/cn";
import { Calendar } from "@/shared/ui/calendar";
import { Input } from "@/shared/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/shared/ui/input-group";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

export interface YmdMaskedInputProps extends Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "onChange"
> {
  /** 현재 `YYYY-MM-DD` (또는 입력 중 부분) 문자열 값 */
  value: string;
  /** 마스킹 정제(`formatYmdInputMask`)를 거친 값 변경 핸들러 */
  onValueChange: (nextValue: string) => void;
}

/**
 * 브라우저 `<input type="date">` 지원 여부와 무관하게 `YYYY-MM-DD` 숫자 입력만 허용하는
 * 공용 마스킹 텍스트 입력 컴포넌트입니다.
 */
export function YmdMaskedInput({
  value,
  onValueChange,
  placeholder = "YYYY-MM-DD",
  className,
  ...props
}: YmdMaskedInputProps) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      maxLength={10}
      value={value}
      onChange={(e) => onValueChange(formatYmdInputMask(e.target.value))}
      placeholder={placeholder}
      className={className}
      {...props}
    />
  );
}

export interface DatePickerInputProps {
  /** 입력 컨트롤 DOM id */
  id?: string | undefined;
  /** 현재 날짜 문자열 (`YYYY-MM-DD` 또는 입력 중 문자열) */
  value?: string | undefined;
  /** 날짜 문자열 변경 핸들러 (빈 문자열이면 `""` 전달) */
  onChange?: ((nextValue: string) => void) | undefined;
  /** 플레이스홀더 안내 문구 (기본값: "YYYY-MM-DD") */
  placeholder?: string | undefined;
  /** 비활성화 여부 */
  disabled?: boolean | undefined;
  /** 추가 스타일 클래스 */
  className?: string | undefined;
}

/**
 * 키보드 `YYYY-MM-DD` 숫자 마스킹 입력과 달력 팝오버 선택을 모두 지원하는
 * 공용 날짜 입력 컴포넌트입니다.
 *
 * 폼 응답 입력(`DynamicField`)과 테이블 필터 등에서 브라우저 환경 차이 없이
 * 일관된 날짜 입력 경험을 제공합니다.
 */
export function DatePickerInput({
  id,
  value,
  onChange,
  placeholder = "YYYY-MM-DD",
  disabled = false,
  className,
}: DatePickerInputProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState("");
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;
  const selectedDate = parseYmdToDate(currentValue);

  const handleValueChange = (nextValue: string) => {
    if (!isControlled) {
      setInternalValue(nextValue);
    }
    onChange?.(nextValue);
  };

  return (
    // Popover를 InputGroupAddon 바깥에 배치해 Portal 클릭 이벤트 버블링으로 인풋 포커스가 빼앗기지 않게 함
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverAnchor asChild>
        <InputGroup
          className={cn("h-9 w-full", className)}
          data-disabled={disabled ? "true" : undefined}
        >
          <InputGroupInput
            id={id}
            type="text"
            inputMode="numeric"
            maxLength={10}
            disabled={disabled}
            value={currentValue}
            onChange={(e) => handleValueChange(formatYmdInputMask(e.target.value))}
            placeholder={placeholder}
          />
          <InputGroupAddon align="inline-end">
            <PopoverTrigger asChild>
              <InputGroupButton
                size="icon-xs"
                disabled={disabled}
                aria-label="달력에서 날짜 선택"
                title="달력에서 날짜 선택"
              >
                <CalendarIcon className="size-4" />
              </InputGroupButton>
            </PopoverTrigger>
          </InputGroupAddon>
        </InputGroup>
      </PopoverAnchor>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={selectedDate}
          {...(selectedDate ? { defaultMonth: selectedDate } : {})}
          onSelect={(date) => {
            handleValueChange(date ? formatDateToYmd(date) : "");
            setIsOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
