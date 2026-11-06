import * as React from "react";
import type { CoreFormField } from "@/entities/form";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { FormFieldWrapper } from "./form-field-wrapper";

/**
 * 필드 렌더러 프로퍼티
 *
 * exactOptionalPropertyTypes 설정에 대응하기 위해
 * 선택적 속성에는 명시적으로 `| undefined`를 유니온으로 허용합니다.
 */
export interface DynamicFieldProps {
  /**
   * 렌더링 대상 코어 폼 필드 정의
   */
  field: CoreFormField;

  /**
   * 현재 네비게이터 또는 사용자가 선택한 필드 여부
   */
  isSelected?: boolean | undefined;

  /**
   * 필드 클릭 핸들러 (네비게이터 대화 패널에 타깃 필드 컨텍스트 전달용)
   */
  onFieldClick?: ((fieldId: string) => void) | undefined;

  /**
   * 필드별 유효성 검사 에러 메시지
   */
  error?: string | undefined;

  /**
   * 비활성화 여부
   */
  disabled?: boolean | undefined;
}

/**
 * 폼 필드 레지스트리 컴포넌트
 *
 * 필드의 type 속성("text" | "textarea" | "number" | "select")에 따라
 * 최적화된 shadcn/ui 기반 입력 컴포넌트를 매핑하여 렌더링합니다.
 */
export function DynamicField({
  field,
  isSelected,
  onFieldClick,
  error,
  disabled = false,
}: DynamicFieldProps) {
  const { id, name, label, type, placeholder, required, options, description } = field;

  /**
   * 필드 타입별 입력 컨트롤 분기 렌더링
   */
  const renderControl = () => {
    switch (type) {
      case "text":
        return (
          <Input
            id={id}
            name={name}
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
            name={name}
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
            name={name}
            type="number"
            placeholder={placeholder}
            required={required}
            disabled={disabled}
          />
        );

      case "select": {
        const selectOptions = options && options.length > 0 ? options : ["선택 옵션 없음"];
        return (
          <Select disabled={disabled}>
            <SelectTrigger id={id} className="w-full">
              <SelectValue placeholder={placeholder ?? "항목을 선택해 주세요"} />
            </SelectTrigger>
            <SelectContent>
              {selectOptions.map((option, index) => (
                <SelectItem key={`${id}-opt-${index}`} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      default:
        // 알 수 없는 타입인 경우 안전한 단문 인풋으로 폴백
        return (
          <Input
            id={id}
            name={name}
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
      name={name}
      label={label}
      required={required}
      description={description}
      error={error}
      isSelected={isSelected}
      onFieldClick={onFieldClick}
    >
      {renderControl()}
    </FormFieldWrapper>
  );
}
