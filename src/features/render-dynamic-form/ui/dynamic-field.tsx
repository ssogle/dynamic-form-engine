"use client";

import * as React from "react";
import { Controller, useFormContext } from "react-hook-form";
import type { CoreFormField, SelectOption } from "@/entities/form";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/shared/ui/combobox";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { Checkbox } from "@/shared/ui/checkbox";
import { DatePickerInput } from "@/shared/ui/date-input";
import { Switch } from "@/shared/ui/switch";
import { Label } from "@/shared/ui/label";
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

  /** 도메인의 대표 식별 필드 여부 */
  isPrimary?: boolean | undefined;

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
 * 선택형 옵션(radio/checkbox)의 라벨과 필수 상세 설명을 함께 렌더링하는 보조 컴포넌트입니다.
 * 긴 설명 문구도 줄바꿈을 유지하여 프로토타입 화면에서 즉시 읽을 수 있도록 구성합니다.
 */
function OptionLabelDescription({ htmlFor, opt }: { htmlFor: string; opt: SelectOption }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Label
        htmlFor={htmlFor}
        className={cn(
          "cursor-pointer text-sm leading-snug font-normal",
          opt.disabled && "text-muted-foreground line-through"
        )}
      >
        {opt.label}
        {opt.disabled && " (비활성화됨)"}
      </Label>
      <p className="text-muted-foreground text-xs leading-relaxed whitespace-pre-wrap">
        {opt.description}
      </p>
    </div>
  );
}

/**
 * 드롭다운(select) 하단에 모든 활성 옵션의 선택 기준(description)을 상시 표시하는 가이드 목록입니다.
 * Radix SelectItem 내부에 긴 설명을 넣으면 선택된 트리거(SelectValue) 레이아웃이 깨지므로,
 * 드롭다운 바깥쪽에 전체 옵션의 상세 설명을 직접 노출합니다.
 */
function SelectOptionsGuideList({ options }: { options: SelectOption[] }) {
  if (options.length === 0) return null;

  return (
    <div className="bg-muted/30 space-y-2 rounded-md border p-2.5 text-xs">
      {options.map((opt) => (
        <div key={opt.value} className="space-y-0.5">
          <p
            className={cn(
              "text-foreground font-medium",
              opt.disabled && "text-muted-foreground line-through"
            )}
          >
            {opt.label}
            {opt.disabled && " (비활성화됨)"}
          </p>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {opt.description}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * 드롭다운(SelectContent) 내부에 표시할 옵션 아이템 목록을 생성하는 공통 렌더러입니다.
 */
function renderSelectOptionItems(visibleOptions: SelectOption[]) {
  if (visibleOptions.length === 0) {
    return (
      <SelectItem value="__empty__" disabled>
        선택 옵션 없음
      </SelectItem>
    );
  }

  return visibleOptions.map((opt) => (
    <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
      {opt.label}
      {opt.disabled && " (비활성화됨)"}
    </SelectItem>
  ));
}

/**
 * 다중 선택 드롭다운(`select` with `multiple: true`) 칩형 Combobox 컴포넌트입니다.
 * `@/shared/ui/combobox`의 `ComboboxChips`를 재사용해 선택된 옵션을 칩으로 표시하고,
 * 비활성 옵션이 이미 저장되어 있는 경우에도 라벨을 온전히 보존해 표시합니다.
 */
function MultiSelectCombobox({
  id,
  options,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  options: SelectOption[];
  value: string[];
  onChange: (nextValues: string[]) => void;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
}) {
  const anchor = useComboboxAnchor();
  const visibleOptions = filterMultiSelectOptions(options, value);
  const optionMap = React.useMemo(
    () => new Map(visibleOptions.map((opt) => [opt.value, opt])),
    [visibleOptions]
  );

  return (
    <div className="space-y-2">
      <Combobox
        multiple
        autoHighlight
        items={visibleOptions.map((opt) => opt.value)}
        value={value}
        onValueChange={(nextValue) => onChange(Array.isArray(nextValue) ? nextValue : [])}
        itemToStringLabel={(val) => optionMap.get(val)?.label ?? val}
        disabled={disabled}
      >
        <ComboboxChips ref={anchor} className="w-full">
          <ComboboxValue>
            {(values: string[]) => (
              <React.Fragment>
                {values.map((val) => {
                  const opt = optionMap.get(val);
                  return (
                    <ComboboxChip key={val}>
                      {opt ? `${opt.label}${opt.disabled ? " (비활성화됨)" : ""}` : val}
                    </ComboboxChip>
                  );
                })}
                <ComboboxChipsInput
                  id={id}
                  placeholder={values.length === 0 ? placeholder || "선택해 주세요" : ""}
                />
              </React.Fragment>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>선택 가능한 옵션이 없습니다.</ComboboxEmpty>
          <ComboboxList>
            {(val: string) => {
              const opt = optionMap.get(val);
              if (!opt) return null;
              return (
                <ComboboxItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                  {opt.disabled && " (비활성화됨)"}
                </ComboboxItem>
              );
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <SelectOptionsGuideList options={visibleOptions} />
    </div>
  );
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
  isPrimary = false,
  isSelected,
  onFieldClick,
  error: propError,
  disabled = false,
}: DynamicFieldProps) {
  const { id, label, type, placeholder, required, multiple, options, relationConfig, description } =
    field;
  const [previewMultiSelect, setPreviewMultiSelect] = React.useState<string[]>([]);

  // React Hook Form 컨텍스트 획득 (컨슈머 제출 모드 또는 FormProvider 래핑 시 유효)
  const formContext = useFormContext();

  // 에러 메시지 우선순위: React Hook Form 에러 > 외부 주입 에러
  const formError = formContext?.formState?.errors?.[id]?.message;
  const displayError = (typeof formError === "string" ? formError : undefined) ?? propError;

  // 입력 컨트롤 렌더링
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
          if (multiple) {
            return (
              <Controller
                name={id}
                control={formContext.control}
                render={({ field: controllerField }) => {
                  const selectedValues: string[] = Array.isArray(controllerField.value)
                    ? controllerField.value
                    : typeof controllerField.value === "string" && controllerField.value.length > 0
                      ? [controllerField.value]
                      : [];
                  return (
                    <MultiSelectCombobox
                      id={id}
                      options={options ?? []}
                      value={selectedValues}
                      onChange={controllerField.onChange}
                      placeholder={placeholder}
                      disabled={disabled}
                    />
                  );
                }}
              />
            );
          }

          return (
            <Controller
              name={id}
              control={formContext.control}
              render={({ field: controllerField }) => {
                // 단일 select도 string[] 표준 포맷을 사용하되 레거시 string 입력을 안전하게 수용합니다.
                const currentValue = Array.isArray(controllerField.value)
                  ? typeof controllerField.value[0] === "string"
                    ? controllerField.value[0]
                    : ""
                  : typeof controllerField.value === "string"
                    ? controllerField.value
                    : "";
                const visibleOptions = filterSingleSelectOptions(options, currentValue);

                return (
                  <div className="space-y-2">
                    <Select
                      value={currentValue}
                      onValueChange={(nextValue) =>
                        controllerField.onChange(nextValue ? [nextValue] : [])
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger id={id} className="w-full">
                        <SelectValue placeholder={placeholder || "선택해 주세요"} />
                      </SelectTrigger>
                      <SelectContent>{renderSelectOptionItems(visibleOptions)}</SelectContent>
                    </Select>
                    <SelectOptionsGuideList options={visibleOptions} />
                  </div>
                );
              }}
            />
          );
        }

        case "radio": {
          return (
            <Controller
              name={id}
              control={formContext.control}
              render={({ field: controllerField }) => {
                const currentValue =
                  typeof controllerField.value === "string" ? controllerField.value : "";
                const visibleOptions = filterSingleSelectOptions(options, currentValue);

                if (visibleOptions.length === 0) {
                  return (
                    <p className="text-muted-foreground text-xs">선택 가능한 옵션이 없습니다.</p>
                  );
                }

                return (
                  <RadioGroup
                    value={currentValue}
                    onValueChange={controllerField.onChange}
                    disabled={disabled}
                    className="flex flex-col gap-3 pt-1"
                  >
                    {visibleOptions.map((opt) => (
                      <div key={opt.value} className="flex items-start gap-2">
                        <RadioGroupItem
                          id={`${id}-${opt.value}`}
                          value={opt.value}
                          disabled={opt.disabled || disabled}
                          className="mt-0.5"
                        />
                        <OptionLabelDescription htmlFor={`${id}-${opt.value}`} opt={opt} />
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
                    <div className="flex flex-col gap-3 pt-1">
                      {visibleOptions.map((opt) => {
                        const isChecked = selectedValues.includes(opt.value);
                        return (
                          <div key={opt.value} className="flex items-start gap-2">
                            <Checkbox
                              id={`${id}-${opt.value}`}
                              checked={isChecked}
                              onCheckedChange={(checked) =>
                                handleToggle(opt.value, Boolean(checked))
                              }
                              disabled={opt.disabled || disabled}
                              className="mt-0.5"
                            />
                            <OptionLabelDescription htmlFor={`${id}-${opt.value}`} opt={opt} />
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
              render={({ field: controllerField }) => (
                <DatePickerInput
                  id={id}
                  value={typeof controllerField.value === "string" ? controllerField.value : ""}
                  onChange={(nextValue) =>
                    controllerField.onChange(nextValue ? nextValue : undefined)
                  }
                  placeholder={placeholder || "YYYY-MM-DD"}
                  disabled={disabled}
                />
              )}
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
          if (!relationConfig?.targetFormId) {
            return (
              <div className="text-muted-foreground bg-muted/40 rounded-md border border-dashed p-2 text-xs">
                관계형 필드 설정(참조 대상 폼 ID)이 올바르지 않습니다.
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
        if (multiple) {
          return (
            <MultiSelectCombobox
              id={id}
              options={options ?? []}
              value={previewMultiSelect}
              onChange={setPreviewMultiSelect}
              placeholder={placeholder}
              disabled={disabled}
            />
          );
        }
        const selectOptions = filterSingleSelectOptions(options, undefined);
        return (
          <div className="space-y-2">
            <Select disabled={disabled}>
              <SelectTrigger id={id} className="w-full">
                <SelectValue placeholder={placeholder || "선택해 주세요"} />
              </SelectTrigger>
              <SelectContent>{renderSelectOptionItems(selectOptions)}</SelectContent>
            </Select>
            <SelectOptionsGuideList options={selectOptions} />
          </div>
        );
      }

      case "radio": {
        const radioOptions = filterSingleSelectOptions(options, undefined);
        if (radioOptions.length === 0) {
          return <p className="text-muted-foreground text-xs">선택 가능한 옵션이 없습니다.</p>;
        }
        return (
          <RadioGroup disabled={disabled} className="flex flex-col gap-3 pt-1">
            {radioOptions.map((opt) => (
              <div key={opt.value} className="flex items-start gap-2">
                <RadioGroupItem
                  id={`${id}-${opt.value}`}
                  value={opt.value}
                  disabled={opt.disabled}
                  className="mt-0.5"
                />
                <OptionLabelDescription htmlFor={`${id}-${opt.value}`} opt={opt} />
              </div>
            ))}
          </RadioGroup>
        );
      }

      case "checkbox": {
        const checkOptions = filterMultiSelectOptions(options, []);
        if (checkOptions.length > 0) {
          return (
            <div className="flex flex-col gap-3 pt-1">
              {checkOptions.map((opt) => (
                <div key={opt.value} className="flex items-start gap-2">
                  <Checkbox
                    id={`${id}-${opt.value}`}
                    disabled={opt.disabled || disabled}
                    className="mt-0.5"
                  />
                  <OptionLabelDescription htmlFor={`${id}-${opt.value}`} opt={opt} />
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
          <DatePickerInput id={id} placeholder={placeholder || "YYYY-MM-DD"} disabled={disabled} />
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
          <div className="text-muted-foreground bg-muted/20 space-y-1.5 rounded-lg border border-dashed p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span>
                연결 도메인:{" "}
                <strong className="text-foreground font-medium">
                  {relationConfig?.targetFormId || "미지정"}
                </strong>
              </span>
              <span className="border-border bg-background rounded border px-2 py-0.5 text-[11px]">
                {relationConfig?.multiple ? "다중 선택 테이블 피커" : "단일 선택 테이블 피커"}
              </span>
            </div>
            <p className="text-[11px]">
              타깃 폼의 대표 필드(primaryFieldId)와 테이블 행(Row) 구조로 선택 및 미리보기를
              제공합니다.
            </p>
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
      isPrimary={isPrimary}
      description={description}
      error={displayError}
      isSelected={isSelected}
      onFieldClick={onFieldClick}
    >
      {renderControl()}
    </FormFieldWrapper>
  );
}
