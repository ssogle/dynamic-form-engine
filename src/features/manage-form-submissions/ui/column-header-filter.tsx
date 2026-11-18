"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Filter, RotateCcw } from "lucide-react";
import { PrimaryFieldBadge, type SelectOption } from "@/entities/form";
import { formatDateToYmd, parseYmdToDate } from "@/shared/lib/date";
import { cn } from "@/shared/lib/cn";
import {
  FIELD_FILTER_OPERATOR_LABELS,
  fieldFilterConditionSchema,
  normalizeFieldFilterCondition,
  resolveTargetFieldCapability,
  validateFiltersAgainstFields,
  type FieldFilterCondition,
  type FieldFilterOperator,
} from "@/shared/schema";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Checkbox } from "@/shared/ui/checkbox";
import { YmdMaskedInput } from "@/shared/ui/date-input";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { formatFilterConditionSummary } from "../lib/filter-summary";
import { RelationColumnFilterPicker } from "./relation-column-filter-picker";

export interface ColumnHeaderFilterProps {
  /** 컬럼 및 필터 대상 필드 ID (도메인 필드 ID 또는 시스템 컬럼 id/createdAt/updatedAt) */
  fieldId: string;
  /** 컬럼 표시 레이블 */
  label: string;
  /** 필드 타입 (CoreFieldType 또는 시스템 컬럼 타입) */
  fieldType: string;
  /** 선택형 필드 옵션 목록 (select, radio, checkbox) */
  options?: SelectOption[] | undefined;
  /** 관계형(relation) 필드의 참조 대상 폼 UUID */
  relationTargetFormId?: string | undefined;
  /** 현재 폼의 대표 식별 필드 여부 */
  isPrimary?: boolean | undefined;
  /** 현재 정렬 방향 */
  isSorted: false | "asc" | "desc";
  /** 정렬 토글 핸들러 (Shift+클릭 지원) */
  onToggleSort: (event: React.MouseEvent) => void;
  /** 현재 적용된 필터 조건 */
  filterCondition?: FieldFilterCondition | undefined;
  /** 필터 적용/해제 핸들러 (undefined 전달 시 해당 컬럼 필터 해제) */
  onApplyFilter: (condition?: FieldFilterCondition) => void;
}

interface FilterDraftState {
  op: FieldFilterOperator;
  scalarValue: string;
  boolValue: "true" | "false";
  selectedValues: string[];
  minValue: string;
  maxValue: string;
}

function createInitialDraft(
  fieldId: string,
  fieldType: string,
  options: SelectOption[] | undefined,
  current?: FieldFilterCondition
): FilterDraftState {
  const capability = resolveTargetFieldCapability(fieldId, { type: fieldType, options });
  const defaultOp = capability?.defaultOperator ?? "contains";

  if (!current) {
    return {
      op: defaultOp,
      scalarValue: "",
      boolValue: "true",
      selectedValues: [],
      minValue: "",
      maxValue: "",
    };
  }

  const normalized = normalizeFieldFilterCondition(current);
  const boolStr = normalized.value === false || normalized.value === "false" ? "false" : "true";

  return {
    op: normalized.op,
    scalarValue: normalized.value !== undefined ? String(normalized.value) : "",
    boolValue: boolStr,
    selectedValues: normalized.values ?? [],
    minValue: normalized.min !== undefined ? String(normalized.min) : "",
    maxValue: normalized.max !== undefined ? String(normalized.max) : "",
  };
}

/**
 * 테이블 컬럼 헤더 정렬 및 필드 타입별 인라인 팝오버 필터 컨트롤 컴포넌트 (ColumnHeaderFilter)
 *
 * 필드 Capability Matrix(@/shared/schema)로부터 지원 연산자와 위젯 타입을 자동 파생하여,
 * 텍스트·숫자(범위/비교)·선택형(비활성 옵션 구분 포함)·불리언·날짜(달력 범위)·관계형(레코드 피커) 필터를 제공합니다.
 */
export function ColumnHeaderFilter({
  fieldId,
  label,
  fieldType,
  options,
  relationTargetFormId,
  isPrimary = false,
  isSorted,
  onToggleSort,
  filterCondition,
  onApplyFilter,
}: ColumnHeaderFilterProps) {
  const capability = React.useMemo(
    () => resolveTargetFieldCapability(fieldId, { type: fieldType, options }),
    [fieldId, fieldType, options]
  );

  const [isOpen, setIsOpen] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<FilterDraftState>(() =>
    createInitialDraft(fieldId, fieldType, options, filterCondition)
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraft(createInitialDraft(fieldId, fieldType, options, filterCondition));
      setErrorMessage(null);
    }
    setIsOpen(nextOpen);
  };

  const widget = capability?.filterWidget ?? "text";
  const isUnary = draft.op === "isEmpty" || draft.op === "isNotEmpty";

  // relation 컨슈머 UI에서는 피커(in) 및 빈값(isEmpty/isNotEmpty) 중심으로 노출
  const visibleOperators = React.useMemo(() => {
    const operators = capability?.filterOperators ?? ["contains"];
    if (widget === "relation") {
      return operators.filter((op) => op === "in" || op === "isEmpty" || op === "isNotEmpty");
    }
    if (widget === "options" && fieldType === "checkbox") {
      return operators.filter((op) => op !== "eq");
    }
    return operators;
  }, [widget, capability, fieldType]);

  const handleOperatorChange = (nextOp: FieldFilterOperator) => {
    setErrorMessage(null);
    setDraft((prev) => ({ ...prev, op: nextOp }));
  };

  const handleToggleOption = (optValue: string, checked: boolean) => {
    setErrorMessage(null);
    setDraft((prev) => {
      const nextValues = checked
        ? Array.from(new Set([...prev.selectedValues, optValue]))
        : prev.selectedValues.filter((v) => v !== optValue);
      return { ...prev, selectedValues: nextValues };
    });
  };

  const buildCandidateCondition = (): FieldFilterCondition | undefined => {
    if (isUnary) {
      return { fieldId, op: draft.op };
    }

    if (widget === "boolean") {
      return {
        fieldId,
        op: draft.op,
        value: draft.boolValue === "true",
      };
    }

    if (draft.op === "between") {
      const minTrimmed = draft.minValue.trim();
      const maxTrimmed = draft.maxValue.trim();
      if (!minTrimmed && !maxTrimmed) {
        return undefined;
      }
      return {
        fieldId,
        op: "between",
        ...(minTrimmed ? { min: widget === "number" ? Number(minTrimmed) : minTrimmed } : {}),
        ...(maxTrimmed ? { max: widget === "number" ? Number(maxTrimmed) : maxTrimmed } : {}),
      };
    }

    if (
      draft.op === "in" ||
      draft.op === "notIn" ||
      draft.op === "hasAny" ||
      draft.op === "hasAll"
    ) {
      if (draft.selectedValues.length === 0) {
        return undefined;
      }
      return {
        fieldId,
        op: draft.op,
        values: draft.selectedValues,
      };
    }

    const trimmed = draft.scalarValue.trim();
    if (!trimmed) {
      return undefined;
    }

    return {
      fieldId,
      op: draft.op,
      value: widget === "number" ? Number(trimmed) : trimmed,
    };
  };

  const handleApply = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    const candidate = buildCandidateCondition();
    if (!candidate) {
      onApplyFilter(undefined);
      setIsOpen(false);
      return;
    }

    if (widget === "number" && !isUnary) {
      if (candidate.op === "between") {
        if (
          (draft.minValue.trim() && Number.isNaN(Number(draft.minValue.trim()))) ||
          (draft.maxValue.trim() && Number.isNaN(Number(draft.maxValue.trim())))
        ) {
          setErrorMessage("유효한 숫자를 입력해 주세요.");
          return;
        }
      } else if (Number.isNaN(Number(draft.scalarValue.trim()))) {
        setErrorMessage("유효한 숫자를 입력해 주세요.");
        return;
      }
    }

    const validated = fieldFilterConditionSchema.safeParse(candidate);
    if (!validated.success) {
      setErrorMessage(validated.error.issues[0]?.message ?? "올바르지 않은 필터 조건입니다.");
      return;
    }

    const fieldValidation = validateFiltersAgainstFields(
      [validated.data],
      [{ id: fieldId, label, type: fieldType, options }],
      { allowSystemFields: true }
    );
    if (fieldValidation.error !== null) {
      setErrorMessage(fieldValidation.error);
      return;
    }

    onApplyFilter(normalizeFieldFilterCondition(validated.data));
    setIsOpen(false);
  };

  const handleClear = () => {
    setErrorMessage(null);
    onApplyFilter(undefined);
    setIsOpen(false);
  };

  const hasFilter = Boolean(filterCondition);
  const filterSummary = filterCondition
    ? formatFilterConditionSummary(filterCondition, {
        id: fieldId,
        label,
        type: fieldType as never,
        options,
      })
    : "";

  const popoverWidthClass =
    widget === "date" || widget === "relation" ? "w-80 p-3 shadow-md" : "w-72 p-3 shadow-md";

  return (
    <div className="flex items-center justify-between gap-1 pr-2">
      {/* 1. 컬럼 타이틀 (말줄임 보장 & 클릭 시 정렬) */}
      <button
        type="button"
        onClick={onToggleSort}
        className="hover:text-foreground flex items-center gap-1.5 truncate text-left font-semibold transition-colors"
        title={`${label} (클릭하여 정렬, Shift+클릭으로 다중 정렬)`}
      >
        <span className="truncate">{label}</span>
        {isPrimary && <PrimaryFieldBadge className="shrink-0" />}
        {isSorted === "asc" && <ArrowUp className="text-primary size-3.5 shrink-0" />}
        {isSorted === "desc" && <ArrowDown className="text-primary size-3.5 shrink-0" />}
        {!isSorted && (
          <ArrowUpDown className="text-muted-foreground/60 size-3 shrink-0 opacity-70" />
        )}
      </button>

      {/* 2. 팝오버 필터 트리거 */}
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`hover:bg-muted size-6 p-0 ${
              hasFilter ? "text-primary bg-primary/10 font-bold" : "text-muted-foreground/70"
            }`}
            title={hasFilter ? `현재 필터 적용 중: ${filterSummary}` : `${label} 필터`}
          >
            <Filter className="size-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className={popoverWidthClass}>
          <form onSubmit={handleApply} className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-foreground text-xs font-semibold">[{label}] 필터</span>
              {hasFilter && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground h-5 px-1.5 text-[10px]"
                  onClick={handleClear}
                >
                  <RotateCcw className="mr-1 size-2.5" />
                  초기화
                </Button>
              )}
            </div>

            {/* 연산자 선택 (복수 연산자 지원 시 노출) */}
            {visibleOperators.length > 1 && (
              <Select
                value={draft.op}
                onValueChange={(val) => handleOperatorChange(val as FieldFilterOperator)}
              >
                <SelectTrigger className="h-7.5 w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {visibleOperators.map((op) => (
                    <SelectItem key={op} value={op} className="text-xs">
                      {FIELD_FILTER_OPERATOR_LABELS[op]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* 위젯별 입력 UI */}
            {!isUnary && widget === "text" && (
              <Input
                autoFocus
                value={draft.scalarValue}
                onChange={(e) => {
                  setErrorMessage(null);
                  setDraft((prev) => ({ ...prev, scalarValue: e.target.value }));
                }}
                placeholder="검색할 키워드 입력..."
                className="h-8 text-xs"
              />
            )}

            {!isUnary && widget === "number" && draft.op === "between" && (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  step="any"
                  value={draft.minValue}
                  onChange={(e) => {
                    setErrorMessage(null);
                    setDraft((prev) => ({ ...prev, minValue: e.target.value }));
                  }}
                  placeholder="최소값"
                  className="h-8 text-xs"
                />
                <Input
                  type="number"
                  step="any"
                  value={draft.maxValue}
                  onChange={(e) => {
                    setErrorMessage(null);
                    setDraft((prev) => ({ ...prev, maxValue: e.target.value }));
                  }}
                  placeholder="최대값"
                  className="h-8 text-xs"
                />
              </div>
            )}

            {!isUnary && widget === "number" && draft.op !== "between" && (
              <Input
                autoFocus
                type="number"
                step="any"
                value={draft.scalarValue}
                onChange={(e) => {
                  setErrorMessage(null);
                  setDraft((prev) => ({ ...prev, scalarValue: e.target.value }));
                }}
                placeholder="숫자 입력..."
                className="h-8 text-xs"
              />
            )}

            {!isUnary && widget === "boolean" && (
              <div className="grid grid-cols-2 gap-2">
                {(["true", "false"] as const).map((val) => (
                  <Button
                    key={val}
                    type="button"
                    size="sm"
                    variant={draft.boolValue === val ? "default" : "outline"}
                    className="h-7.5 text-xs"
                    onClick={() => setDraft((prev) => ({ ...prev, boolValue: val }))}
                  >
                    {val === "true" ? "예" : "아니오"}
                  </Button>
                ))}
              </div>
            )}

            {!isUnary && widget === "options" && (
              <>
                {draft.op === "eq" ? (
                  <Select
                    value={draft.scalarValue}
                    onValueChange={(val) => {
                      setErrorMessage(null);
                      setDraft((prev) => ({ ...prev, scalarValue: val }));
                    }}
                  >
                    <SelectTrigger className="h-8 w-full text-xs">
                      <SelectValue placeholder="옵션 선택..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(options ?? []).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          <span
                            className={cn(opt.disabled && "text-muted-foreground line-through")}
                          >
                            {opt.label}
                          </span>
                          {opt.disabled && " (비활성화됨)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded border p-1.5">
                    {(options ?? []).length === 0 ? (
                      <p className="text-muted-foreground py-2 text-center text-[11px]">
                        선택 가능한 옵션이 없습니다.
                      </p>
                    ) : (
                      (options ?? []).map((opt) => {
                        const isChecked = draft.selectedValues.includes(opt.value);
                        return (
                          <label
                            key={opt.value}
                            className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs select-none"
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) =>
                                handleToggleOption(opt.value, Boolean(checked))
                              }
                            />
                            <span
                              className={cn(
                                "truncate",
                                opt.disabled && "text-muted-foreground line-through"
                              )}
                            >
                              {opt.label}
                              {opt.disabled && " (비활성화됨)"}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                )}
              </>
            )}

            {!isUnary && widget === "date" && draft.op === "between" && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <YmdMaskedInput
                    value={draft.minValue}
                    onValueChange={(nextValue) => {
                      setErrorMessage(null);
                      setDraft((prev) => ({ ...prev, minValue: nextValue }));
                    }}
                    className="h-7 text-[11px]"
                  />
                  <YmdMaskedInput
                    value={draft.maxValue}
                    onValueChange={(nextValue) => {
                      setErrorMessage(null);
                      setDraft((prev) => ({ ...prev, maxValue: nextValue }));
                    }}
                    className="h-7 text-[11px]"
                  />
                </div>
                <Calendar
                  mode="range"
                  selected={{
                    from: parseYmdToDate(draft.minValue),
                    to: parseYmdToDate(draft.maxValue),
                  }}
                  onSelect={(range) => {
                    setErrorMessage(null);
                    setDraft((prev) => ({
                      ...prev,
                      minValue: range?.from ? formatDateToYmd(range.from) : "",
                      maxValue: range?.to ? formatDateToYmd(range.to) : "",
                    }));
                  }}
                  className="rounded-md border"
                />
              </div>
            )}

            {!isUnary && widget === "date" && draft.op !== "between" && (
              <div className="space-y-2">
                <YmdMaskedInput
                  value={draft.scalarValue}
                  onValueChange={(nextValue) => {
                    setErrorMessage(null);
                    setDraft((prev) => ({ ...prev, scalarValue: nextValue }));
                  }}
                  className="h-7 text-xs"
                />
                <Calendar
                  mode="single"
                  selected={parseYmdToDate(draft.scalarValue)}
                  onSelect={(date) => {
                    setErrorMessage(null);
                    setDraft((prev) => ({
                      ...prev,
                      scalarValue: date ? formatDateToYmd(date) : "",
                    }));
                  }}
                  className="rounded-md border"
                />
              </div>
            )}

            {!isUnary && widget === "relation" && (
              <>
                {relationTargetFormId ? (
                  <RelationColumnFilterPicker
                    targetFormId={relationTargetFormId}
                    selectedIds={draft.selectedValues}
                    onChangeSelectedIds={(nextIds) => {
                      setErrorMessage(null);
                      setDraft((prev) => ({ ...prev, selectedValues: nextIds }));
                    }}
                  />
                ) : (
                  <p className="text-muted-foreground text-[11px]">
                    참조 대상 폼이 설정되지 않았습니다.
                  </p>
                )}
              </>
            )}

            {errorMessage && <p className="text-destructive text-[11px]">{errorMessage}</p>}

            <div className="flex justify-end gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setIsOpen(false)}
              >
                취소
              </Button>
              <Button type="submit" size="sm" className="h-7 px-2.5 text-xs">
                적용
              </Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
