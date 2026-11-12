"use client";

import * as React from "react";
import { useFormSubmissionsQuery, type FormSubmission } from "@/entities/form-submission";
import { Skeleton } from "@/shared/ui/skeleton";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/shared/ui/combobox";
import { XIcon } from "lucide-react";

export interface RelationFieldInputProps {
  /**
   * 참조 대상 도메인 폼의 불변 UUID
   */
  targetFormId: string;

  /**
   * 콤보박스 선택지 목록에 노출할 타깃 폼의 대표 필드 ID (예: 'p_name', 'f_title')
   */
  displayField: string;

  /**
   * 다중 참조(N:M) 허용 여부 (기본값: false - 단일 레코드 참조)
   */
  multiple?: boolean | undefined;

  /**
   * 현재 선택된 서브미션 UUID(단일) 또는 UUID 배열(다중)
   */
  value?: string | string[] | undefined;

  /**
   * 선택 변경 이벤트 핸들러
   */
  onChange: (value: string | string[] | undefined) => void;

  /**
   * 비활성화 여부
   */
  disabled?: boolean | undefined;

  /**
   * 힌트 플레이스홀더 문구
   */
  placeholder?: string | undefined;
}

interface RelationOption {
  id: string;
  label: string;
}

/**
 * 도메인 간 관계형 필드(type: "relation") 전용 콤보박스 입력 컴포넌트
 *
 * 타깃 도메인 폼의 서브미션 목록을 서버에서 비동기 페칭하여
 * 대표 노출 필드(displayField)를 검색 가능한 선택지 목록으로 렌더링하고,
 * 선택 시 대상 레코드의 불변 UUID를 폼 데이터에 영속화합니다.
 */
export function RelationFieldInput({
  targetFormId,
  displayField,
  multiple = false,
  value,
  onChange,
  disabled = false,
  placeholder,
}: RelationFieldInputProps) {
  // 1. 타깃 폼의 기제출 응답 목록 페칭
  const { data: submissions, isLoading, isError } = useFormSubmissionsQuery(targetFormId);

  // 2. 서브미션 데이터를 검색/표시용 RelationOption 목록으로 가공
  const options: RelationOption[] = React.useMemo(() => {
    if (!submissions || !Array.isArray(submissions)) return [];

    return submissions.map((sub: FormSubmission) => {
      const rowData = (sub.data ?? {}) as Record<string, unknown>;
      const displayVal = rowData[displayField];
      let label = "";

      if (displayVal !== undefined && displayVal !== null && String(displayVal).trim() !== "") {
        label = String(displayVal);
      } else {
        label = `레코드 (${sub.id.slice(0, 8)})`;
      }

      return {
        id: sub.id,
        label,
      };
    });
  }, [submissions, displayField]);

  // 선택된 항목의 라벨을 빠르게 조회하기 위한 맵
  const optionMap = React.useMemo(() => {
    const map = new Map<string, string>();
    options.forEach((opt) => map.set(opt.id, opt.label));
    return map;
  }, [options]);

  // 로딩 상태 처리
  if (isLoading) {
    return <Skeleton className="h-9 w-full rounded-md" />;
  }

  // 조회 에러 상태 처리
  if (isError) {
    return (
      <div className="text-destructive border-destructive/30 bg-destructive/5 rounded-md border p-2 text-xs">
        참조 대상 도메인 데이터를 불러오지 못했습니다.
      </div>
    );
  }

  // 데이터 부재 처리
  if (options.length === 0) {
    return (
      <div className="text-muted-foreground bg-muted/40 rounded-md border border-dashed p-2 text-center text-xs">
        연결할 수 있는 대상 레코드가 없습니다.
      </div>
    );
  }

  // 다중 선택 모드 (multiple: true)
  if (multiple) {
    const selectedIds: string[] = Array.isArray(value) ? value : [];

    const handleSelect = (selectedId: string | null) => {
      if (!selectedId) return;
      if (!selectedIds.includes(selectedId)) {
        onChange([...selectedIds, selectedId]);
      }
    };

    const handleRemove = (idToRemove: string) => {
      onChange(selectedIds.filter((id) => id !== idToRemove));
    };

    return (
      <div className="space-y-2">
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedIds.map((id) => (
              <Badge key={id} variant="secondary" className="gap-1 pr-1 text-xs">
                <span>{optionMap.get(id) ?? id.slice(0, 8)}</span>
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-3.5 p-0 hover:bg-transparent"
                    onClick={() => handleRemove(id)}
                  >
                    <XIcon className="size-3" />
                  </Button>
                )}
              </Badge>
            ))}
          </div>
        )}
        <Combobox value={null} onValueChange={handleSelect} disabled={disabled}>
          <ComboboxInput
            placeholder={placeholder || "연결할 레코드를 검색하여 선택하세요..."}
            disabled={disabled}
            className="w-full"
          />
          <ComboboxContent>
            <ComboboxList>
              <ComboboxEmpty>검색 결과가 없습니다.</ComboboxEmpty>
              {options
                .filter((opt) => !selectedIds.includes(opt.id))
                .map((opt) => (
                  <ComboboxItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </ComboboxItem>
                ))}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
    );
  }

  // 단일 선택 모드 (multiple: false)
  const singleSelectedId = typeof value === "string" ? value : null;

  return (
    <Combobox
      value={singleSelectedId}
      onValueChange={(newVal) => onChange(newVal ?? undefined)}
      disabled={disabled}
    >
      <ComboboxInput
        placeholder={
          singleSelectedId
            ? (optionMap.get(singleSelectedId) ?? singleSelectedId.slice(0, 8))
            : placeholder || "연결할 레코드를 선택하세요..."
        }
        disabled={disabled}
        className="w-full"
      />
      <ComboboxContent>
        <ComboboxList>
          <ComboboxEmpty>검색 결과가 없습니다.</ComboboxEmpty>
          {options.map((opt) => (
            <ComboboxItem key={opt.id} value={opt.id}>
              {opt.label}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
