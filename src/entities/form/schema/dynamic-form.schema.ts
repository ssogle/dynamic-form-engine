import { z } from "zod";
import type { CoreFormField, SelectOption } from "./form-field.schema";
import type { SubmissionValidationResult } from "../types/dynamic-form.types";

/**
 * 필드의 options 정의로부터 유효한 value 목록을 추출합니다.
 */
function extractOptionValues(options?: SelectOption[]): string[] {
  if (!options || options.length === 0) return [];
  return options.map((opt) => opt.value);
}

/**
 * 텍스트 및 텍스트영역 필드 검증 스키마 생성기
 *
 * @param field 코어 폼 필드 메타데이터
 * @returns Zod 문자열 스키마
 */
function createTextFieldSchema(field: CoreFormField): z.ZodType {
  return z
    .string()
    .optional()
    .superRefine((val, ctx) => {
      const isEmpty = val === "" || val === null || val === undefined || val.trim() === "";
      if (isEmpty && field.required) {
        ctx.addIssue({
          code: "custom",
          message: `${field.label} 항목은 필수 입력입니다.`,
        });
      }
    })
    .transform((val) => {
      if (val === "" || val === undefined) return undefined;
      return typeof val === "string" ? val.trim() : val;
    });
}

/**
 * 숫자 필드 검증 스키마 생성기
 * 문자열 형태의 숫자 입력("42")을 안전하게 number 타입으로 파싱하고 NaN을 방어합니다.
 * 키 누락(Missing Property) 시에도 optional()을 통해 안전하게 통과합니다.
 *
 * @param field 코어 폼 필드 메타데이터
 * @returns Zod 숫자 스키마
 */
function createNumberFieldSchema(field: CoreFormField): z.ZodType {
  return z
    .union([z.number(), z.string()])
    .optional()
    .superRefine((val, ctx) => {
      const isEmpty = val === "" || val === null || val === undefined;

      if (isEmpty) {
        if (field.required) {
          ctx.addIssue({
            code: "custom",
            message: `${field.label} 항목은 필수 입력입니다.`,
          });
        }
        return;
      }

      const num = Number(val);
      if (Number.isNaN(num)) {
        ctx.addIssue({
          code: "custom",
          message: `${field.label} 항목은 유효한 숫자여야 합니다.`,
        });
      }
    })
    .transform((val) => {
      if (val === "" || val === null || val === undefined) return undefined;
      return Number(val);
    });
}

/**
 * 선택형 배열(select 단일/다중 및 checkbox with options) 공통 검증 스키마 생성기
 *
 * - `select`는 단일(`multiple: false`)과 다중(`multiple: true`) 모두 `string[]` 포맷으로 저장합니다.
 * - 레거시 단일 문자열 값이 유입되더라도 안전하게 문자열 배열로 정규화하여 하위 호환을 보장합니다.
 * - `enforceSingle: true`일 때는 1개 초과 선택을 차단합니다.
 */
function createMultiOptionArraySchema(
  field: CoreFormField,
  options?: { enforceSingle?: boolean | undefined }
): z.ZodType {
  const validValues = extractOptionValues(field.options);

  return z
    .preprocess((rawVal) => {
      if (rawVal === undefined || rawVal === null || rawVal === "") {
        return [];
      }
      return Array.isArray(rawVal) ? rawVal : [rawVal];
    }, z.array(z.string()))
    .superRefine((val, ctx) => {
      if (val.length === 0) {
        if (field.required) {
          ctx.addIssue({
            code: "custom",
            message: `${field.label} 항목은 필수 선택입니다.`,
          });
        }
        return;
      }

      if (options?.enforceSingle && val.length > 1) {
        ctx.addIssue({
          code: "custom",
          message: `${field.label} 항목은 최대 1개까지 선택할 수 있습니다.`,
        });
        return;
      }

      if (validValues.length > 0) {
        const invalidValues = val.filter((v) => !validValues.includes(v));
        if (invalidValues.length > 0) {
          ctx.addIssue({
            code: "custom",
            message: `${field.label} 항목에 올바르지 않은 선택지가 포함되어 있습니다.`,
          });
        }
      }
    });
}

/**
 * 셀렉트(select) 필드 검증 스키마 생성기
 * 단일/다중 선택 모두 표준 string[] 배열 포맷으로 저장·검증하며,
 * multiple이 false(또는 미지정)인 경우 최대 1개 선택 제약을 적용합니다.
 *
 * @param field 코어 폼 필드 메타데이터
 * @returns Zod 셀렉트 배열 스키마
 */
function createSelectFieldSchema(field: CoreFormField): z.ZodType {
  return createMultiOptionArraySchema(field, {
    enforceSingle: !field.multiple,
  });
}

/**
 * 라디오(radio) 필드 검증 스키마 생성기
 * 단일 문자열 화이트리스트 검증을 수행합니다.
 *
 * @param field 코어 폼 필드 메타데이터
 * @returns Zod 라디오 문자열 스키마
 */
function createRadioFieldSchema(field: CoreFormField): z.ZodType {
  const validValues = extractOptionValues(field.options);

  return z
    .string()
    .optional()
    .superRefine((val, ctx) => {
      const isEmpty = val === "" || val === null || val === undefined;

      if (isEmpty) {
        if (field.required) {
          ctx.addIssue({
            code: "custom",
            message: `${field.label} 항목은 필수 입력입니다.`,
          });
        }
        return;
      }

      if (validValues.length > 0 && !validValues.includes(val)) {
        ctx.addIssue({
          code: "custom",
          message: `${field.label} 항목은 제공된 선택지 중 하나여야 합니다.`,
        });
      }
    })
    .transform((val) => (val === "" || val === undefined ? undefined : val));
}

/**
 * 체크박스(checkbox) 검증 스키마 생성기
 * 옵션이 없는 단일 불리언 토글과 옵션이 있는 다중 선택 그룹(string[])을 모두 지원합니다.
 *
 * @param field 코어 폼 필드 메타데이터
 * @returns Zod 체크박스 스키마
 */
function createCheckboxFieldSchema(field: CoreFormField): z.ZodType {
  const hasOptions = Boolean(field.options && field.options.length > 0);

  // 1. 단일 불리언 체크박스 (옵션 목록이 없는 경우)
  if (!hasOptions) {
    if (field.required) {
      return z
        .boolean()
        .optional()
        .refine((val) => val === true, {
          message: `${field.label} 항목은 필수 확인(체크) 사항입니다.`,
        });
    }
    return z.boolean().default(false);
  }

  // 2. 다중 선택 체크박스 (옵션 목록이 정의된 경우)
  return createMultiOptionArraySchema(field);
}

/**
 * 순수 달력 날짜(date) 필드 검증 스키마 생성기 (YYYY-MM-DD 형식)
 *
 * @param field 코어 폼 필드 메타데이터
 * @returns Zod 날짜 문자열 스키마
 */
function createDateFieldSchema(field: CoreFormField): z.ZodType {
  return z
    .string()
    .optional()
    .superRefine((val, ctx) => {
      const isEmpty = val === "" || val === null || val === undefined;

      if (isEmpty) {
        if (field.required) {
          ctx.addIssue({
            code: "custom",
            message: `${field.label} 항목은 필수 입력입니다.`,
          });
        }
        return;
      }

      if (!z.iso.date().safeParse(val).success) {
        ctx.addIssue({
          code: "custom",
          message: `${field.label} 항목은 YYYY-MM-DD 형식의 올바른 날짜여야 합니다.`,
        });
      }
    })
    .transform((val) => (val === "" || val === undefined ? undefined : val));
}

/**
 * 참/거짓 모던 토글 스위치(switch) 필드 검증 스키마 생성기
 *
 * @param field 코어 폼 필드 메타데이터
 * @returns Zod 불리언 스키마
 */
function createSwitchFieldSchema(field: CoreFormField): z.ZodType {
  if (field.required) {
    return z
      .boolean()
      .optional()
      .refine((val) => val === true, {
        message: `${field.label} 항목은 필수 활성화(동의) 사항입니다.`,
      });
  }
  return z.boolean().default(false);
}

/**
 * 관계형 도메인 필드(relation) 검증 스키마 생성기
 * 단일/다중 선택 모두 표준 string[] 배열 포맷으로 저장·검증하며,
 * 기존 단일 UUID 문자열 레거시 입력도 배열로 정규화하여 호환성을 유지합니다.
 *
 * @param field 코어 폼 필드 메타데이터
 * @returns Zod 관계형 배열 스키마
 */
function createRelationFieldSchema(field: CoreFormField): z.ZodType {
  const isMultiple = field.relationConfig?.multiple ?? false;

  return z
    .preprocess(
      (rawVal) => {
        if (rawVal === undefined || rawVal === null || rawVal === "") {
          return [];
        }
        return Array.isArray(rawVal) ? rawVal : [rawVal];
      },
      z.array(z.uuid("올바른 UUID 형식이어야 합니다."))
    )
    .superRefine((val, ctx) => {
      if (val.length === 0 && field.required) {
        ctx.addIssue({
          code: "custom",
          message: `${field.label} 항목은 필수 선택입니다.`,
        });
        return;
      }

      if (!isMultiple && val.length > 1) {
        ctx.addIssue({
          code: "custom",
          message: `${field.label} 항목은 최대 1개까지 선택할 수 있습니다.`,
        });
      }
    });
}

/**
 * 폼 필드 스키마 배열(CoreFormField[])을 바탕으로 동적 Zod Object 스키마를 생성합니다.
 *
 * 생성된 Zod 스키마는:
 * 1. 클라이언트에서 React Hook Form의 `zodResolver(schema)`로 실시간 검증에 사용되고,
 * 2. 서버에서 API 요청 본문(`schema.safeParse`)의 데이터 무결성 검증에 100% 동일하게 재사용됩니다.
 *
 * @param fields 대상 폼의 필드 정의 배열
 * @returns z.ZodObject<Record<string, z.ZodType>> 동적으로 조립된 Zod 객체 스키마
 */
export function buildDynamicFormSchema(
  fields: CoreFormField[]
): z.ZodObject<Record<string, z.ZodType>> {
  const shape: Record<string, z.ZodType> = {};

  // 소프트 삭제(deletedAt 존재)된 과거 필드는 스키마 조립에서 제외합니다.
  const activeFields = fields.filter((field) => !field.deletedAt);

  for (const field of activeFields) {
    let fieldSchema: z.ZodType;

    switch (field.type) {
      case "text":
      case "textarea":
        fieldSchema = createTextFieldSchema(field);
        break;

      case "number":
        fieldSchema = createNumberFieldSchema(field);
        break;

      case "select":
        fieldSchema = createSelectFieldSchema(field);
        break;

      case "radio":
        fieldSchema = createRadioFieldSchema(field);
        break;

      case "checkbox":
        fieldSchema = createCheckboxFieldSchema(field);
        break;

      case "date":
        fieldSchema = createDateFieldSchema(field);
        break;

      case "switch":
        fieldSchema = createSwitchFieldSchema(field);
        break;

      case "relation":
        fieldSchema = createRelationFieldSchema(field);
        break;

      default:
        fieldSchema = z
          .any()
          .optional()
          .superRefine((val, ctx) => {
            if ((val === undefined || val === null || val === "") && field.required) {
              ctx.addIssue({
                code: "custom",
                message: `${field.label} 항목은 필수 입력입니다.`,
              });
            }
          });
        break;
    }

    shape[field.id] = fieldSchema;
  }

  return z.object(shape);
}

/**
 * 폼 필드 스키마와 원시 응답 데이터를 바탕으로 Zod 스키마를 구성하고 런타임 유효성을 검증합니다.
 * 불변 field.id를 키로 삼아 유효성을 검사하고 스키마 외 잉여 필드를 자동 정제합니다.
 *
 * @param fields 대상 폼의 필드 정의 배열
 * @param rawData 클라이언트가 제출한 Key-Value 응답 데이터
 * @returns SubmissionValidationResult 검증 통과 여부, 에러 맵, 정제된 데이터 반환
 */
export function validateSubmissionData(
  fields: CoreFormField[],
  rawData: Record<string, unknown>
): SubmissionValidationResult {
  // 소프트 삭제되지 않은 활성 필드만 검증 대상으로 필터링
  const activeFields = fields.filter((field) => !field.deletedAt);

  // 1. 활성 필드에 등록된 field.id 항목만 선별
  const targetData: Record<string, unknown> = {};

  for (const field of activeFields) {
    if (rawData[field.id] !== undefined) {
      targetData[field.id] = rawData[field.id];
    }
  }

  // 2. 동적 Zod 스키마 조립 (field.id 기반)
  const dynamicSchema = buildDynamicFormSchema(activeFields);

  // 3. 런타임 스키마 파싱 및 유효성 검사
  const parseResult = dynamicSchema.safeParse(targetData);

  if (!parseResult.success) {
    const errors: Record<string, string> = {};

    for (const issue of parseResult.error.issues) {
      const fieldPath = issue.path[0];
      if (typeof fieldPath === "string") {
        errors[fieldPath] = issue.message;
      }
    }

    return {
      isValid: false,
      errors,
    };
  }

  // 4. 유효성 검사 통과 시 불필요한 잉여 필드가 제거되고 타입이 정제된 데이터만 반환
  return {
    isValid: true,
    errors: {},
    cleanedData: parseResult.data as Record<string, unknown>,
  };
}
