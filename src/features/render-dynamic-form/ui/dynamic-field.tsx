"use client";

import * as React from "react";
import { Controller, useFormContext } from "react-hook-form";
import type { CoreFormField } from "@/entities/form";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { Checkbox } from "@/shared/ui/checkbox";
import { Switch } from "@/shared/ui/switch";
import { Separator } from "@/shared/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { filterSingleSelectOptions, filterMultiSelectOptions } from "../lib/filter-select-options";
import { FormFieldWrapper } from "./form-field-wrapper";
import { RelationFieldInput } from "./relation-field-input";

/**
 * 동적 필드 컴포넌트 Props 인터페이스
 */
export interface DynamicFieldProps {
  /** 렌더링 대상 코어 폼 필드 정의 */
  field: CoreFormField;

  /** 현재 네비게이터 또는 사용자가 선택한 필드 여부 */
  isSelected?: boolean | undefined;

  /** 필드 클릭 핸들러 (네비게이터 대화 패널에 타깃 필드 컨텍스트 전달용) */
  onFieldClick?: ((fieldId: string) => void) | undefined;

  /** 외부에서 직접 주입하는 에러 메시지 (React Hook Form 외부 사용 시) */
  error?: string | undefined;

  /** 비활성화 여부 */
  disabled?: boolean | undefined;
}

/**
 * Date 객체에서 타임존 왜곡 없이 'YYYY-MM-DD' 순수 일자 문자열을 추출하는 유틸리티
 */
function formatDateToYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 'YYYY-MM-DD' 문자열을 로컬 Date 객체로 안전하게 파싱하는 유틸리티
 */
function parseYmdToDate(ymd?: string | unknown): Date | undefined {
  if (typeof ymd !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return undefined;
  }
  const [yearStr, monthStr, dayStr] = ymd.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

/**
 * 폼 필드 렌더러 컴포넌트 (DynamicField)
 *
 * 필드의 type 속성(코어 8종 입력 + 1종 레이아웃)에 따라
 * 최적화된 shadcn/ui 기반 입력 컴포넌트를 매핑하여 렌더링합니다.
 *
 * [수정 폼 비활성 옵션 예외 공식]
 * - 단일 선택: !opt.disabled || opt.value === currentValue
 * - 다중 선택: !opt.disabled || selectedValues.includes(opt.value)
 * 과거 데이터가 소프트 비활성화되어도 라벨을 온전히 렌더링하여 빈칸 버그를 원천 차단합니다.
 */
export function DynamicField({
  field,
  isSelected,
  onFieldClick,
  error: propError,
  disabled = false,
}: DynamicFieldProps) {
  const { id, label, type, placeholder, required, options, relationConfig, description } = field;

  // React Hook Form 컨텍스트 획득 (컨슈머 제출 모드 또는 FormProvider 래핑 시 유효)
  const formContext = useFormContext();

  // 에러 메시지 우선순위: React Hook Form 에러 > 외부 주입 에러
  const formError = formContext?.formState?.errors?.[id]?.message;
  const displayError = (typeof formError === "string" ? formError : undefined) ?? propError;

  // 1. 레이아웃 전용 구분선(section) 필드 분기 (데이터 입력 컨트롤이 아님)
  if (type === "section") {
    return (
      <div
        className={cn(
          "space-y-2 pt-6 pb-2 transition-all",
          isSelected && "ring-ring/50 rounded-md p-2 ring-2 ring-offset-2"
        )}
        onClick={() => onFieldClick?.(id)}
      >
        <div className="flex flex-col gap-0.5">
          <h3 className="text-foreground text-base font-semibold tracking-tight">{label}</h3>
          {description && <p className="text-muted-foreground text-xs">{description}</p>}
        </div>
        <Separator className="mt-2" />
      </div>
    );
  }

  // 2. 입력 컨트롤 렌더링
  const renderControl = () => {
    // A. React Hook Form 컨텍스트가 주입된 경우 (실제 제출 / 수정 모드)
    if (formContext) {
      switch (type) {
        case "text":
          return (
            <Input
              id={id}
              placeholder={placeholder}
              disabled={disabled}
              {...formContext.register(id)}
            />
          );

        case "textarea":
          return (
            <Textarea
              id={id}
              placeholder={placeholder}
              disabled={disabled}
              className="min-h-24 resize-y"
              {...formContext.register(id)}
            />
          );

        case "number":
          return (
            <Input
              id={id}
              type="number"
              placeholder={placeholder}
              disabled={disabled}
              {...formContext.register(id)}
            />
          );

        case "select": {
          const rawOptions = options && options.length > 0 ? options : ["선택 옵션 없음"];

          return (
            <Controller
              name={id}
              control={formContext.control}
              render={({ field: controllerField }) => {
                const currentValue =
                  typeof controllerField.value === "string" ? controllerField.value : "";
                const visibleOptions = filterSingleSelectOptions(rawOptions, currentValue);

                return (
                  <Select
                    value={currentValue}
                    onValueChange={controllerField.onChange}
                    disabled={disabled}
                  >
                    <SelectTrigger id={id} className="w-full">
                      <SelectValue placeholder={placeholder || "선택해 주세요"} />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                          {opt.label}
                          {opt.disabled && " (비활성화됨)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              }}
            />
          );
        }

        case "radio": {
          const rawOptions = options && options.length > 0 ? options : ["옵션 없음"];

          return (
            <Controller
              name={id}
              control={formContext.control}
              render={({ field: controllerField }) => {
                const currentValue =
                  typeof controllerField.value === "string" ? controllerField.value : "";
                const visibleOptions = filterSingleSelectOptions(rawOptions, currentValue);

                return (
                  <RadioGroup
                    value={currentValue}
                    onValueChange={controllerField.onChange}
                    disabled={disabled}
                    className="flex flex-col gap-2 pt-1"
                  >
                    {visibleOptions.map((opt) => (
                      <div key={opt.value} className="flex items-center gap-2">
                        <RadioGroupItem
                          id={`${id}-${opt.value}`}
                          value={opt.value}
                          disabled={opt.disabled || disabled}
                        />
                        <Label
                          htmlFor={`${id}-${opt.value}`}
                          className={cn(
                            "cursor-pointer text-sm font-normal",
                            opt.disabled && "text-muted-foreground line-through"
                          )}
                        >
                          {opt.label}
                          {opt.disabled && " (비활성화됨)"}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                );
              }}
            />
          );
        }

        case "checkbox": {
          return (
            <Controller
              name={id}
              control={formContext.control}
              render={({ field: controllerField }) => {
                // 1) 옵션 목록이 정의된 경우: string[] 다중 선택 체크박스
                if (options && options.length > 0) {
                  const selectedValues: string[] = Array.isArray(controllerField.value)
                    ? controllerField.value
                    : [];
                  const visibleOptions = filterMultiSelectOptions(options, selectedValues);

                  const handleToggle = (optVal: string, isChecked: boolean) => {
                    if (isChecked) {
                      controllerField.onChange([...selectedValues, optVal]);
                    } else {
                      controllerField.onChange(selectedValues.filter((v) => v !== optVal));
                    }
                  };

                  return (
                    <div className="flex flex-col gap-2 pt-1">
                      {visibleOptions.map((opt) => {
                        const isChecked = selectedValues.includes(opt.value);
                        return (
                          <div key={opt.value} className="flex items-center gap-2">
                            <Checkbox
                              id={`${id}-${opt.value}`}
                              checked={isChecked}
                              onCheckedChange={(checked) =>
                                handleToggle(opt.value, Boolean(checked))
                              }
                              disabled={opt.disabled || disabled}
                            />
                            <Label
                              htmlFor={`${id}-${opt.value}`}
                              className={cn(
                                "cursor-pointer text-sm font-normal",
                                opt.disabled && "text-muted-foreground line-through"
                              )}
                            >
                              {opt.label}
                              {opt.disabled && " (비활성화됨)"}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // 2) 옵션 목록이 없는 경우: 단일 불리언 체크박스
                const isChecked = Boolean(controllerField.value);
                return (
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      id={id}
                      checked={isChecked}
                      onCheckedChange={(checked) => controllerField.onChange(Boolean(checked))}
                      disabled={disabled}
                    />
                    <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
                      {placeholder || label}
                    </Label>
                  </div>
                );
              }}
            />
          );
        }

        case "date": {
          return (
            <Controller
              name={id}
              control={formContext.control}
              render={({ field: controllerField }) => {
                const dateValue = parseYmdToDate(controllerField.value);

                return (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id={id}
                        type="button"
                        variant="outline"
                        disabled={disabled}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !controllerField.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 size-4" />
                        {typeof controllerField.value === "string" && controllerField.value
                          ? controllerField.value
                          : placeholder || "날짜를 선택하세요"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateValue}
                        onSelect={(date) => {
                          if (date) {
                            controllerField.onChange(formatDateToYmd(date));
                          } else {
                            controllerField.onChange(undefined);
                          }
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                );
              }}
            />
          );
        }

        case "switch": {
          return (
            <Controller
              name={id}
              control={formContext.control}
              render={({ field: controllerField }) => (
                <div className="flex items-center gap-3 pt-1">
                  <Switch
                    id={id}
                    checked={Boolean(controllerField.value)}
                    onCheckedChange={(checked) => controllerField.onChange(Boolean(checked))}
                    disabled={disabled}
                  />
                  {placeholder && (
                    <Label htmlFor={id} className="text-muted-foreground text-xs font-normal">
                      {placeholder}
                    </Label>
                  )}
                </div>
              )}
            />
          );
        }

        case "relation": {
          if (!relationConfig?.targetFormId || !relationConfig.displayField) {
            return (
              <div className="text-muted-foreground bg-muted/40 rounded-md border border-dashed p-2 text-xs">
                관계형 필드 설정(참조 폼 및 대표 필드)이 올바르지 않습니다.
              </div>
            );
          }

          return (
            <Controller
              name={id}
              control={formContext.control}
              render={({ field: controllerField }) => (
                <RelationFieldInput
                  targetFormId={relationConfig.targetFormId}
                  displayField={relationConfig.displayField}
                  multiple={relationConfig.multiple ?? false}
                  value={controllerField.value as string | string[] | undefined}
                  onChange={controllerField.onChange}
                  disabled={disabled}
                  placeholder={placeholder}
                />
              )}
            />
          );
        }

        default:
          return (
            <Input
              id={id}
              placeholder={placeholder}
              disabled={disabled}
              {...formContext.register(id)}
            />
          );
      }
    }

    // B. 프리뷰 모드 등 FormProvider 없이 단순 미리보기로 렌더링되는 경우
    switch (type) {
      case "text":
        return (
          <Input
            id={id}
            name={id}
            type="text"
            placeholder={placeholder}
            required={required}
            disabled={disabled}
          />
        );

      case "textarea":
        return (
          <Textarea
            id={id}
            name={id}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            className="min-h-24 resize-y"
          />
        );

      case "number":
        return (
          <Input
            id={id}
            name={id}
            type="number"
            placeholder={placeholder}
            required={required}
            disabled={disabled}
          />
        );

      case "select": {
        const rawOptions = options && options.length > 0 ? options : ["선택 옵션 없음"];
        const selectOptions = filterSingleSelectOptions(rawOptions, undefined);
        return (
          <Select disabled={disabled}>
            <SelectTrigger id={id} className="w-full">
              <SelectValue placeholder={placeholder || "선택해 주세요"} />
            </SelectTrigger>
            <SelectContent>
              {selectOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                  {opt.disabled && " (비활성화됨)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      case "radio": {
        const rawOptions = options && options.length > 0 ? options : ["옵션 없음"];
        const radioOptions = filterSingleSelectOptions(rawOptions, undefined);
        return (
          <RadioGroup disabled={disabled} className="flex flex-col gap-2 pt-1">
            {radioOptions.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <RadioGroupItem
                  id={`${id}-${opt.value}`}
                  value={opt.value}
                  disabled={opt.disabled}
                />
                <Label
                  htmlFor={`${id}-${opt.value}`}
                  className="cursor-pointer text-sm font-normal"
                >
                  {opt.label}
                  {opt.disabled && " (비활성화됨)"}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );
      }

      case "checkbox": {
        const checkOptions = filterMultiSelectOptions(options, []);
        if (checkOptions.length > 0) {
          return (
            <div className="flex flex-col gap-2 pt-1">
              {checkOptions.map((opt) => (
                <div key={opt.value} className="flex items-center gap-2">
                  <Checkbox id={`${id}-${opt.value}`} disabled={opt.disabled || disabled} />
                  <Label
                    htmlFor={`${id}-${opt.value}`}
                    className="cursor-pointer text-sm font-normal"
                  >
                    {opt.label}
                    {opt.disabled && " (비활성화됨)"}
                  </Label>
                </div>
              ))}
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2 pt-1">
            <Checkbox id={id} disabled={disabled} />
            <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
              {placeholder || label}
            </Label>
          </div>
        );
      }

      case "date":
        return (
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className="text-muted-foreground w-full justify-start text-left font-normal"
          >
            <CalendarIcon className="mr-2 size-4" />
            <span>{placeholder || "YYYY-MM-DD"}</span>
          </Button>
        );

      case "switch":
        return (
          <div className="flex items-center gap-3 pt-1">
            <Switch id={id} disabled={disabled} />
            {placeholder && (
              <Label htmlFor={id} className="text-muted-foreground text-xs font-normal">
                {placeholder}
              </Label>
            )}
          </div>
        );

      case "relation":
        return (
          <div className="text-muted-foreground bg-muted/30 rounded-md border border-dashed p-2 text-xs">
            [관계형 연결] 대상 폼:{" "}
            {relationConfig?.targetFormId
              ? `${relationConfig.targetFormId.slice(0, 8)}...`
              : "미지정"}{" "}
            (대표 필드: {relationConfig?.displayField ?? "미지정"})
          </div>
        );

      default:
        return (
          <Input
            id={id}
            name={id}
            type="text"
            placeholder={placeholder}
            required={required}
            disabled={disabled}
          />
        );
    }
  };

  return (
    <FormFieldWrapper
      id={id}
      label={label}
      required={required}
      description={description}
      error={displayError}
      isSelected={isSelected}
      onFieldClick={onFieldClick}
    >
      {renderControl()}
    </FormFieldWrapper>
  );
}
