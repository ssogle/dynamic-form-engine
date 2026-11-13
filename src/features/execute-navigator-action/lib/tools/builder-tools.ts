import { tool } from "ai";
import { z } from "zod";
import {
  coreFormFieldSchema,
  extractActiveFields,
  extractPrimaryFieldId,
  extractRawFields,
  mergeOptionsWithPreservation,
  normalizeSelectOption,
  normalizeSelectOptions,
  selectOptionSchema,
  validatePrimaryFieldSelection,
  type CoreFormField,
  type Form,
  type InsertForm,
  type SelectOption,
  type UpdateForm,
} from "@/entities/form";
import { nowUtcIso } from "@/shared/lib/date";
import type { NavigatorBuilderAction, SchemaOperation } from "../../types/navigator-action.types";

/**
 * 폼 엔티티의 schemaDefinition 내부에서 CoreFormField 배열을 안전하게 추출하는 유틸리티
 */
export function extractFieldsFromForm(form?: Form | null): CoreFormField[] {
  return extractRawFields(form);
}

/**
 * 필드 ID 또는 label과 일치하는지 지능적으로 대조하는 판별 함수
 */
function matchesTargetField(field: CoreFormField, targetIdentifier?: string): boolean {
  if (!targetIdentifier) return false;
  const normTarget = targetIdentifier.trim().toLowerCase().replace(/\s+/g, "");
  const normId = field.id.trim().toLowerCase().replace(/\s+/g, "");
  const normLabel = field.label.trim().toLowerCase().replace(/\s+/g, "");

  return (
    normId === normTarget ||
    normLabel === normTarget ||
    normTarget.includes(normLabel) ||
    normLabel.includes(normTarget)
  );
}

/**
 * 빌더 변경/제어 도구 카탈로그에서 사용할 DB 저장소 의존성 인터페이스
 */
export interface BuilderToolsDependencies {
  findFormById: (id: string) => Promise<Form | undefined>;
  hasSubmissionsByFormId?: (formId: string) => Promise<boolean>;
  insertForm: (input: InsertForm) => Promise<Form>;
  updateFormById: (id: string, updates: UpdateForm) => Promise<Form | undefined>;
  publishFormById: (id: string, isPublished: boolean) => Promise<Form | undefined>;
  softDeleteFormsByIds: (ids: string[]) => Promise<Form[]>;
}

/**
 * 대상 폼이 과거 응답 데이터 무결성 보호 대상인지 판별합니다.
 *
 * 현재 공식 발행 상태(publishedAt !== null)이거나,
 * 발행 취소 후라도 이미 제출된 응답 데이터가 1건 이상 존재하면 true를 반환하여
 * 필드 및 옵션의 물리 삭제를 원천 차단하고 소프트 삭제/비활성화로 보존합니다.
 *
 * @param form 검사 대상 폼 엔티티
 * @param deps 저장소 의존성
 * @returns 보호 대상 여부 (true: 소프트 보존 강제, false: 초기 초안 물리 삭제 허용)
 */
async function isFormHistoryProtected(
  form: Form,
  deps: BuilderToolsDependencies
): Promise<boolean> {
  if (form.publishedAt !== null && form.publishedAt !== undefined) {
    return true;
  }
  if (deps.hasSubmissionsByFormId) {
    return await deps.hasSubmissionsByFormId(form.id);
  }
  return false;
}

// 1. navigate 입력 스키마
export const navigateInputSchema = z.object({
  targetPath: z.string().describe("이동할 절대 경로 (예: /builder/forms, /builder/forms/[id])"),
  reason: z.string().optional().describe("이동 사유 또는 목적"),
});

// 2. createForm 입력 스키마
export const createFormInputSchema = z
  .object({
    title: z.string().min(1, "폼 제목은 필수입니다.").describe("폼 제목"),
    description: z.string().optional().describe("폼에 대한 설명"),
    primaryFieldId: z
      .string({ message: "대표 식별자 필드(primaryFieldId) 지정은 필수입니다." })
      .trim()
      .min(1, "대표 식별자 필드(primaryFieldId) 지정은 필수입니다.")
      .describe(
        "이 도메인 레코드를 대표하여 식별할 기본 필드 ID (반드시 fields에 포함되고 checkbox·relation이 아닌 활성 필드 ID여야 함)"
      ),
    fields: z
      .array(coreFormFieldSchema)
      .min(1, "폼에는 최소 1개 이상의 필드가 포함되어야 합니다.")
      .describe(
        "생성할 초기 필드 배열 (text, textarea, number, select, radio, checkbox, date, switch, relation — 모든 필드에 description 필수)"
      ),
  })
  .superRefine((val, ctx) => {
    const check = validatePrimaryFieldSelection(val.fields, val.primaryFieldId);
    if (!check.isValid) {
      ctx.addIssue({
        code: "custom",
        path: ["primaryFieldId"],
        message: check.reason ?? "유효하지 않은 대표 필드(primaryFieldId)입니다.",
      });
    }
  });

// 3. updateSchema 입력 스키마
export const updateSchemaInputSchema = z.object({
  formId: z.uuid("수정 대상 폼의 ID(UUID)는 필수입니다.").describe("수정할 대상 폼의 고유 ID"),
  operation: z
    .enum([
      "ADD_FIELD",
      "REMOVE_FIELD",
      "MODIFY_FIELD",
      "UPDATE_INFO",
      "SET_ALL_FIELDS",
      "SET_PRIMARY_FIELD",
    ])
    .describe(
      "수행할 스키마 조작 유형 (다중 수정이나 복합 필드 변경 시에는 SET_ALL_FIELDS, 대표 식별 필드 변경 시에는 SET_PRIMARY_FIELD 사용)"
    ),
  targetFieldId: z
    .string()
    .optional()
    .describe("수정/삭제 대상 필드 식별자 (단일 필드 ADD/REMOVE/MODIFY 시 사용)"),
  primaryFieldId: z
    .string()
    .optional()
    .describe(
      "대표 식별자 필드(primaryFieldId)로 지정하거나 교체할 활성 필드의 ID 또는 라벨 (SET_PRIMARY_FIELD 시 필수, SET_ALL_FIELDS에서 기존 대표 필드를 대체할 때도 전달)"
    ),
  fieldData: coreFormFieldSchema.partial().optional().describe("추가 또는 변경할 단일 필드 데이터"),
  fields: z
    .array(coreFormFieldSchema)
    .optional()
    .describe("전체 필드 일괄 교체 시 전달하는 완성된 필드 목록 (SET_ALL_FIELDS 시 필수)"),
  formTitle: z.string().optional().describe("변경할 폼 제목"),
});

// 4. publishForm 입력 스키마
export const publishFormInputSchema = z.object({
  formId: z
    .uuid("발행 대상 폼의 ID(UUID)는 필수입니다.")
    .describe("발행 상태를 변경할 대상 폼의 고유 ID"),
  isPublished: z.boolean().describe("발행 여부 (true: 공개 발행, false: 비발행/초안 회수)"),
});

// 5. deleteForms 입력 스키마
export const deleteFormsInputSchema = z.object({
  formIds: z
    .array(z.uuid())
    .min(1, "삭제할 폼 ID는 최소 1개 이상이어야 합니다.")
    .describe("삭제할 대상 폼의 UUID 배열 (단일 폼 삭제 시에도 원소가 1개인 배열로 전달)"),
  reason: z.string().optional().describe("삭제 사유"),
});

// 6. addRelationField 입력 스키마
export const addRelationFieldInputSchema = z.object({
  formId: z
    .uuid("현재 작업 중인 폼의 ID(UUID)는 필수입니다.")
    .describe("관계형 필드를 추가할 폼의 ID"),
  label: z
    .string()
    .min(1, "필드 라벨을 입력해 주세요.")
    .describe("화면에 표시될 관계형 필드 라벨 (예: '참조 프로젝트', '소속 부서')"),
  targetFormId: z
    .uuid("참조할 대상 폼의 ID(UUID)는 필수입니다.")
    .describe("관계(외래키)를 맺을 타깃 도메인 폼의 UUID"),
  multiple: z
    .boolean()
    .default(false)
    .describe("다중 선택 허용 여부 (기본값: false - 단일 레코드 참조)"),
  required: z.boolean().default(false).describe("필수 선택 여부"),
  description: z
    .string()
    .trim()
    .min(1, "관계형 필드의 연결 의미 설명은 필수입니다.")
    .describe(
      "이 관계형 필드가 타깃 폼과 어떤 비즈니스 의미로 연결되는지 설명하는 1문장 (예: '이 업무를 요청한 담당자를 연결합니다.')"
    ),
});

// 7. updateFieldOptions 입력 스키마
export const updateFieldOptionsInputSchema = z.object({
  formId: z
    .uuid("수정 대상 폼의 ID(UUID)는 필수입니다.")
    .describe("옵션을 수정할 대상 폼의 고유 ID"),
  targetFieldId: z
    .string()
    .min(1, "대상 필드 식별자는 필수입니다.")
    .describe("옵션을 수정할 대상 필드의 ID 또는 라벨"),
  operation: z
    .enum(["ADD_OPTIONS", "REMOVE_OPTION", "DISABLE_OPTION", "ENABLE_OPTION", "SET_OPTIONS"])
    .describe(
      "옵션 조작 유형: 'DISABLE_OPTION'(소프트 비활성화 - 과거 데이터 무결성 보존을 위해 삭제 대신 강력 권장), 'ENABLE_OPTION'(비활성화 해제), 'ADD_OPTIONS'(옵션 추가), 'REMOVE_OPTION'(물리 삭제), 'SET_OPTIONS'(전체 옵션 교체)"
    ),
  options: z
    .array(selectOptionSchema)
    .optional()
    .describe("SET_OPTIONS 또는 ADD_OPTIONS 시 추가/교체할 옵션 목록"),
  targetOptionValue: z
    .string()
    .optional()
    .describe(
      "DISABLE_OPTION, ENABLE_OPTION, REMOVE_OPTION 시 조작 대상 옵션의 불변 코드값(value) 또는 표시 라벨(label)"
    ),
});

/**
 * AI Builder Navigator Vercel AI SDK 도구 카탈로그 생성 팩토리 함수
 *
 * 폼 조회(searchForms, getFormDetails)는 공통 queryTools가 전담하므로,
 * 본 도구 모음은 화면 이동 및 폼 생성/수정/삭제/발행 액션만 담당합니다.
 */
export function createBuilderTools(deps: BuilderToolsDependencies) {
  const navigateTool = tool({
    description:
      "애플리케이션 내의 다른 화면으로 이동합니다. 폼 목록(/builder/forms), 라이브 캔버스(/builder/forms/[id]), 뷰 목록(/builder/views) 등으로 이동할 때 호출합니다.",
    inputSchema: navigateInputSchema,
    execute: async ({ targetPath, reason }: z.infer<typeof navigateInputSchema>) => {
      const action: NavigatorBuilderAction = {
        type: "NAVIGATE",
        targetPath,
        message: reason ?? "해당 화면으로 이동합니다.",
      };
      return {
        success: true,
        targetPath,
        reason: reason ?? "화면 이동",
        clientAction: action,
      };
    },
  });

  const createFormTool = tool({
    description:
      "새로운 폼을 생성하고 데이터베이스에 영속화합니다. 폼 생성 후 즉시 해당 폼의 라이브 캔버스(/builder/forms/[id])로 이동하도록 처리됩니다.",
    inputSchema: createFormInputSchema,
    execute: async ({
      title,
      description,
      primaryFieldId,
      fields,
    }: z.infer<typeof createFormInputSchema>) => {
      const created = await deps.insertForm({
        title,
        description: description ?? null,
        schemaDefinition: { primaryFieldId, fields },
      });

      const action: NavigatorBuilderAction = {
        type: "CREATE_FORM",
        formId: created.id,
        title: created.title,
        description: created.description ?? undefined,
        primaryFieldId: extractPrimaryFieldId(created) ?? primaryFieldId,
        fields: extractFieldsFromForm(created),
        message: `새로운 폼 '${created.title}'을 생성했습니다.`,
      };

      return {
        success: true,
        form: created,
        targetPath: `/builder/forms/${created.id}`,
        clientAction: action,
      };
    },
  });

  const updateSchemaTool = tool({
    description:
      "기존 폼의 필드를 추가, 수정, 삭제하거나 전체 필드를 일괄 교체(SET_ALL_FIELDS), 대표 식별 필드 변경(SET_PRIMARY_FIELD)을 수행합니다.",
    inputSchema: updateSchemaInputSchema,
    execute: async ({
      formId,
      operation,
      targetFieldId,
      primaryFieldId: inputPrimaryFieldId,
      fieldData,
      fields: newFieldsList,
      formTitle,
    }: z.infer<typeof updateSchemaInputSchema>) => {
      const existing = await deps.findFormById(formId);
      if (!existing) {
        return {
          success: false,
          error: `수정 대상 폼('${formId}')을 찾을 수 없습니다.`,
        };
      }

      const currentFields = extractFieldsFromForm(existing);
      const existingPrimaryFieldId = extractPrimaryFieldId(existing);
      let nextPrimaryFieldId: string | undefined = existingPrimaryFieldId;
      const isProtected = await isFormHistoryProtected(existing, deps);
      let updatedFields: CoreFormField[] = [...currentFields];

      if (operation === "SET_ALL_FIELDS") {
        if (!newFieldsList || newFieldsList.length === 0) {
          return {
            success: false,
            error: "SET_ALL_FIELDS 오퍼레이션에는 최소 1개 이상의 완성된 fields 배열이 필수입니다.",
          };
        }

        const currentFieldMap = new Map(currentFields.map((f) => [f.id, f]));

        // 보호 대상 폼(발행 이후 또는 기제출 응답 보유)에서는 선택형 필드의 누락된 기존 옵션도 disabled: true로 보존 병합합니다.
        const mergedNewFields: CoreFormField[] = newFieldsList.map((newField) => {
          if (!isProtected) {
            return newField;
          }
          const existingField = currentFieldMap.get(newField.id);
          if (
            existingField &&
            (newField.type === "select" ||
              newField.type === "radio" ||
              newField.type === "checkbox") &&
            existingField.options
          ) {
            return {
              ...newField,
              options: mergeOptionsWithPreservation(existingField.options, newField.options),
            };
          }
          return newField;
        });

        if (isProtected) {
          const nowIso = nowUtcIso();
          const newFieldIdSet = new Set(mergedNewFields.map((f) => f.id));

          // 보호 대상 폼에서는 누락된 기존 필드를 물리 삭제하지 않고 deletedAt을 부여하여 영구 보존합니다.
          const preservedDeletedFields: CoreFormField[] = currentFields
            .filter((oldField) => !newFieldIdSet.has(oldField.id))
            .map((oldField) => ({
              ...oldField,
              deletedAt: oldField.deletedAt ?? nowIso,
            }));

          updatedFields = [...mergedNewFields, ...preservedDeletedFields];
        } else {
          // 미발행 초기 빌드 상태(응답 0건)에서는 누락된 기존 필드를 깔끔하게 물리 삭제합니다.
          updatedFields = mergedNewFields;
        }

        // SET_ALL_FIELDS에서 대체 primaryFieldId가 전달된 경우 새 활성 필드 ID로 해석하여 갱신합니다.
        if (inputPrimaryFieldId && inputPrimaryFieldId.trim().length > 0) {
          const matchedPrimary = mergedNewFields.find((f) =>
            matchesTargetField(f, inputPrimaryFieldId)
          );
          nextPrimaryFieldId = matchedPrimary ? matchedPrimary.id : inputPrimaryFieldId;
        }
      } else if (operation === "SET_PRIMARY_FIELD") {
        const candidateIdentifier = inputPrimaryFieldId ?? targetFieldId;
        if (!candidateIdentifier || candidateIdentifier.trim().length === 0) {
          return {
            success: false,
            error:
              "SET_PRIMARY_FIELD 오퍼레이션에는 변경할 대표 필드 ID 또는 라벨(primaryFieldId)이 필수입니다.",
          };
        }

        const activeFields = extractActiveFields(existing);
        const matched = activeFields.find((f) => matchesTargetField(f, candidateIdentifier));
        if (!matched) {
          return {
            success: false,
            error: `대표 필드로 지정할 활성 필드('${candidateIdentifier}')를 찾을 수 없습니다.`,
          };
        }

        nextPrimaryFieldId = matched.id;
      } else if (operation === "ADD_FIELD") {
        if (
          !fieldData ||
          !fieldData.label ||
          !fieldData.type ||
          !fieldData.description ||
          fieldData.description.trim().length === 0
        ) {
          return {
            success: false,
            error: "필드 추가 시 label, type, description은 필수입니다.",
          };
        }
        const newField: CoreFormField = {
          id: fieldData.id ?? `f_${Date.now().toString(36)}`,
          label: fieldData.label,
          type: fieldData.type,
          required: fieldData.required ?? false,
          placeholder: fieldData.placeholder ?? undefined,
          description: fieldData.description.trim(),
          options: fieldData.options ?? undefined,
          relationConfig: fieldData.relationConfig ?? undefined,
        };
        updatedFields.push(newField);
      } else if (operation === "REMOVE_FIELD") {
        if (!targetFieldId) {
          return {
            success: false,
            error: "필드 삭제 시 대상 targetFieldId는 필수입니다.",
          };
        }

        // 현재 도메인의 대표 식별 필드(primaryFieldId)는 직접 삭제할 수 없도록 선제 차단합니다.
        const activeTarget = currentFields.find(
          (f) => !f.deletedAt && matchesTargetField(f, targetFieldId)
        );
        if (activeTarget && existingPrimaryFieldId && activeTarget.id === existingPrimaryFieldId) {
          return {
            success: false,
            error: `현재 폼의 대표 필드('${activeTarget.label}', ID: ${activeTarget.id})는 삭제할 수 없습니다. 먼저 'SET_PRIMARY_FIELD' 오퍼레이션으로 다른 활성 필드를 대표 필드로 변경한 뒤 삭제해 주세요.`,
          };
        }

        if (isProtected) {
          const nowIso = nowUtcIso();
          let targetFound = false;

          // 보호 대상 폼에서는 과거 데이터의 라벨 무결성 보존을 위해 물리 삭제 대신 소프트 삭제(deletedAt)로 처리합니다.
          updatedFields = updatedFields.map((f) => {
            if (matchesTargetField(f, targetFieldId) && !f.deletedAt) {
              targetFound = true;
              return {
                ...f,
                deletedAt: nowIso,
              };
            }
            return f;
          });

          if (!targetFound) {
            return {
              success: false,
              error: `삭제 대상 필드('${targetFieldId}')를 찾을 수 없거나 이미 소프트 삭제된 필드입니다.`,
            };
          }
        } else {
          // 미발행 초기 빌드 상태(응답 0건)에서는 대상 필드를 물리 삭제합니다.
          const initialLength = updatedFields.length;
          updatedFields = updatedFields.filter((f) => !matchesTargetField(f, targetFieldId));

          if (updatedFields.length === initialLength) {
            return {
              success: false,
              error: `삭제 대상 필드('${targetFieldId}')를 찾을 수 없습니다.`,
            };
          }
        }
      } else if (operation === "MODIFY_FIELD") {
        if (!targetFieldId || !fieldData) {
          return {
            success: false,
            error: "필드 수정 시 targetFieldId와 fieldData는 필수입니다.",
          };
        }

        updatedFields = updatedFields.map((f): CoreFormField => {
          if (!matchesTargetField(f, targetFieldId)) return f;

          let resolvedOptions = f.options;
          if (fieldData.options !== undefined) {
            // 보호 대상 폼에서는 옵션 수정 시 누락된 기존 옵션을 disabled: true로 보존 병합합니다.
            resolvedOptions = isProtected
              ? mergeOptionsWithPreservation(f.options, fieldData.options)
              : fieldData.options;
          }

          return {
            ...f,
            ...fieldData,
            label: fieldData.label ?? f.label,
            type: fieldData.type ?? f.type,
            required: fieldData.required ?? f.required,
            placeholder:
              fieldData.placeholder !== undefined ? fieldData.placeholder : f.placeholder,
            description:
              fieldData.description !== undefined ? fieldData.description : f.description,
            options: resolvedOptions,
            relationConfig:
              fieldData.relationConfig !== undefined ? fieldData.relationConfig : f.relationConfig,
            id: f.id,
          };
        });
      }

      // 모든 스키마 변경 후 최종 상태의 대표 필드(primaryFieldId) 무결성을 검증합니다.
      if (!nextPrimaryFieldId) {
        return {
          success: false,
          error:
            "현재 폼에 대표 필드(primaryFieldId)가 지정되어 있지 않습니다. SET_PRIMARY_FIELD로 대표 필드를 먼저 지정해 주세요.",
        };
      }
      const primaryValidation = validatePrimaryFieldSelection(updatedFields, nextPrimaryFieldId);
      if (!primaryValidation.isValid) {
        return {
          success: false,
          error:
            primaryValidation.reason && primaryValidation.reason.includes("대표 필드")
              ? primaryValidation.reason
              : `대표 필드(primaryFieldId) 무결성 검증 실패: ${primaryValidation.reason ?? "활성 필드 중 유효한 대표 필드를 유지해야 합니다."}`,
        };
      }

      const updatePayload: UpdateForm = {
        title: formTitle ?? existing.title,
        schemaDefinition: {
          primaryFieldId: nextPrimaryFieldId,
          fields: updatedFields,
        },
      };

      const updated = await deps.updateFormById(existing.id, updatePayload);

      const rawOp = operation as string;
      const op: SchemaOperation =
        rawOp === "UPDATE_INFO" || rawOp === "MODIFY_FIELD"
          ? "UPDATE_FIELD"
          : (rawOp as SchemaOperation);

      const action: NavigatorBuilderAction = {
        type: "UPDATE_SCHEMA",
        operation: op,
        formId: existing.id,
        primaryFieldId: nextPrimaryFieldId,
        field: fieldData as CoreFormField | undefined,
        fields: newFieldsList,
        title: formTitle,
        message: "폼 스키마가 성공적으로 변경되었습니다.",
      };

      return {
        success: true,
        operation,
        updatedForm: updated,
        fieldsCount: updatedFields.length,
        clientAction: action,
      };
    },
  });

  const publishFormTool = tool({
    description: "폼의 공식 발행 상태를 설정하거나 취소(초안 복귀)합니다.",
    inputSchema: publishFormInputSchema,
    execute: async ({ formId, isPublished }: z.infer<typeof publishFormInputSchema>) => {
      const existing = await deps.findFormById(formId);
      if (!existing) {
        return {
          success: false,
          error: `대상 폼('${formId}')을 찾을 수 없습니다.`,
        };
      }

      // 발행 요청 시 빈 폼 발행 방지 가드레일
      if (isPublished) {
        const activeFields = extractActiveFields(existing);
        if (activeFields.length === 0) {
          return {
            success: false,
            error:
              "최소 1개 이상의 필드가 포함된 폼만 공식 발행할 수 있습니다. 필드를 먼저 추가해 주세요.",
          };
        }
      }

      // 중앙 DB 시계(sql`now()`)를 통해 발행/초안 상태 전이
      const updated = await deps.publishFormById(existing.id, isPublished);
      if (!updated) {
        return {
          success: false,
          error: "폼 발행 상태를 변경하지 못했습니다.",
        };
      }

      const action: NavigatorBuilderAction = {
        type: "PUBLISH_FORM",
        formId,
        isPublished,
        message: isPublished
          ? "폼이 공식 발행되었습니다. 응답자가 작성할 수 있습니다."
          : "폼 발행이 취소되어 초안 상태로 회수되었습니다.",
      };

      return {
        success: true,
        formId,
        isPublished,
        form: updated,
        clientAction: action,
      };
    },
  });

  const deleteFormsTool = tool({
    description: "지정된 ID의 폼을 소프트 삭제합니다.",
    inputSchema: deleteFormsInputSchema,
    execute: async ({ formIds, reason }: z.infer<typeof deleteFormsInputSchema>) => {
      const deleted = await deps.softDeleteFormsByIds(formIds);

      const action: NavigatorBuilderAction = {
        type: "DELETE_FORMS",
        deletedIds: deleted.map((f) => f.id),
        message: "선택한 폼을 성공적으로 삭제했습니다.",
      };

      return {
        success: true,
        deletedIds: deleted.map((f) => f.id),
        deletedCount: deleted.length,
        reason: reason ?? "사용자 요청에 의한 삭제",
        targetPath: "/builder/forms",
        clientAction: action,
      };
    },
  });

  const addRelationFieldTool = tool({
    description:
      "현재 폼에 다른 도메인 폼을 참조하는 관계형 필드(type: 'relation')를 추가합니다. 타깃 폼의 대표 식별 필드(primaryFieldId)와 테이블 스키마 유효성을 검증하여 연결합니다.",
    inputSchema: addRelationFieldInputSchema,
    execute: async ({
      formId,
      label,
      targetFormId,
      multiple,
      required,
      description,
    }: z.infer<typeof addRelationFieldInputSchema>) => {
      // 1. 현재 작업 중인 폼 및 대표 필드 유효성 검증
      const currentForm = await deps.findFormById(formId);
      if (!currentForm) {
        return {
          success: false,
          error: `현재 작업 대상 폼('${formId}')을 찾을 수 없습니다.`,
        };
      }

      const currentPrimaryFieldId = extractPrimaryFieldId(currentForm);
      if (!currentPrimaryFieldId) {
        return {
          success: false,
          error:
            "현재 폼에 대표 필드(primaryFieldId)가 지정되어 있지 않습니다. 먼저 SET_PRIMARY_FIELD로 대표 필드를 지정해 주세요.",
        };
      }

      // 2. 참조 대상 타깃 폼 존재 여부 및 타깃 폼의 대표 필드(primaryFieldId) 검증
      const targetForm = await deps.findFormById(targetFormId);
      if (!targetForm) {
        return {
          success: false,
          error: `참조 대상 타깃 폼('${targetFormId}')을 찾을 수 없습니다. 올바른 폼 ID인지 확인해 주세요.`,
        };
      }

      const targetFields = extractFieldsFromForm(targetForm);
      const targetPrimaryFieldId = extractPrimaryFieldId(targetForm);
      const targetPrimaryCheck = validatePrimaryFieldSelection(targetFields, targetPrimaryFieldId);
      if (!targetPrimaryCheck.isValid || !targetPrimaryFieldId) {
        return {
          success: false,
          error: `참조 대상 폼 '${targetForm.title}'에 유효한 대표 식별 필드(primaryFieldId)가 설정되어 있지 않아 관계 필드를 연결할 수 없습니다. (${targetPrimaryCheck.reason ?? "primaryFieldId 누락"})`,
        };
      }

      const currentFields = extractFieldsFromForm(currentForm);
      const newFieldId = `f_rel_${Date.now().toString(36)}`;
      const newField: CoreFormField = {
        id: newFieldId,
        label,
        type: "relation",
        required: required ?? false,
        description: description.trim(),
        relationConfig: {
          targetFormId: targetForm.id,
          multiple: multiple ?? false,
        },
      };

      const updatedFields = [...currentFields, newField];
      const updated = await deps.updateFormById(currentForm.id, {
        schemaDefinition: {
          primaryFieldId: currentPrimaryFieldId,
          fields: updatedFields,
        },
      });

      const action: NavigatorBuilderAction = {
        type: "UPDATE_SCHEMA",
        operation: "ADD_FIELD",
        formId: currentForm.id,
        primaryFieldId: currentPrimaryFieldId,
        field: newField,
        message: `'${targetForm.title}' 폼을 참조하는 관계형 필드 '${label}'을 추가했습니다.`,
      };

      return {
        success: true,
        field: newField,
        targetFormTitle: targetForm.title,
        targetPrimaryFieldId,
        updatedForm: updated,
        clientAction: action,
      };
    },
  });

  const updateFieldOptionsTool = tool({
    description:
      "선택형 필드(select, radio, checkbox)의 옵션 목록을 조작합니다. 과거 데이터 무결성을 위해 삭제 대신 'DISABLE_OPTION'(소프트 비활성화)을 권장합니다.",
    inputSchema: updateFieldOptionsInputSchema,
    execute: async ({
      formId,
      targetFieldId,
      operation,
      options: newOptionsInput,
      targetOptionValue,
    }: z.infer<typeof updateFieldOptionsInputSchema>) => {
      const existing = await deps.findFormById(formId);
      if (!existing) {
        return {
          success: false,
          error: `대상 폼('${formId}')을 찾을 수 없습니다.`,
        };
      }

      const currentFields = extractFieldsFromForm(existing);
      const targetFieldIndex = currentFields.findIndex((f) => matchesTargetField(f, targetFieldId));

      if (targetFieldIndex === -1) {
        return {
          success: false,
          error: `대상 필드('${targetFieldId}')를 폼에서 찾을 수 없습니다.`,
        };
      }

      const targetField = currentFields[targetFieldIndex];
      if (!targetField) {
        return {
          success: false,
          error: `대상 필드('${targetFieldId}')를 폼에서 찾을 수 없습니다.`,
        };
      }

      if (
        targetField.type !== "select" &&
        targetField.type !== "radio" &&
        targetField.type !== "checkbox"
      ) {
        return {
          success: false,
          error: `필드 '${targetField.label}'(타입: ${targetField.type})은 옵션을 지원하는 선택형 필드가 아닙니다.`,
        };
      }

      const isProtected = await isFormHistoryProtected(existing, deps);

      // 기존 옵션 목록을 SelectOption[] 형태로 정리 (설명 필드 포함 정규화)
      const existingOptions = normalizeSelectOptions(targetField.options);

      let updatedOptions: SelectOption[] = [...existingOptions];

      switch (operation) {
        case "DISABLE_OPTION": {
          if (!targetOptionValue) {
            return {
              success: false,
              error: "비활성화할 대상 옵션의 value 또는 label을 targetOptionValue로 전달해 주세요.",
            };
          }
          const normTarget = targetOptionValue.trim().toLowerCase();
          let found = false;
          updatedOptions = updatedOptions.map((opt) => {
            if (opt.value.toLowerCase() === normTarget || opt.label.toLowerCase() === normTarget) {
              found = true;
              return { ...opt, disabled: true };
            }
            return opt;
          });
          if (!found) {
            return {
              success: false,
              error: `옵션 목록에서 '${targetOptionValue}' 항목을 찾지 못했습니다.`,
            };
          }
          break;
        }

        case "ENABLE_OPTION": {
          if (!targetOptionValue) {
            return {
              success: false,
              error: "활성화할 대상 옵션의 value 또는 label을 targetOptionValue로 전달해 주세요.",
            };
          }
          const normTarget = targetOptionValue.trim().toLowerCase();
          updatedOptions = updatedOptions.map((opt) => {
            if (opt.value.toLowerCase() === normTarget || opt.label.toLowerCase() === normTarget) {
              return { ...opt, disabled: false };
            }
            return opt;
          });
          break;
        }

        case "ADD_OPTIONS": {
          if (!newOptionsInput || newOptionsInput.length === 0) {
            return {
              success: false,
              error: "추가할 옵션 목록(options)을 전달해 주세요.",
            };
          }
          const existingValues = new Set(updatedOptions.map((o) => o.value));
          for (const opt of newOptionsInput) {
            if (!existingValues.has(opt.value)) {
              updatedOptions.push(normalizeSelectOption(opt));
              existingValues.add(opt.value);
            }
          }
          break;
        }

        case "REMOVE_OPTION": {
          // 보호 대상 폼(발행 이후 또는 기제출 응답 보유)에서는 옵션 물리 삭제를 원천 차단합니다.
          if (isProtected) {
            return {
              success: false,
              error:
                "이미 발행되었거나 제출 응답이 존재하는 폼의 옵션은 과거 데이터 무결성을 보존하기 위해 삭제할 수 없습니다. 대신 'DISABLE_OPTION'(소프트 비활성화)을 사용해 주세요.",
            };
          }
          if (!targetOptionValue) {
            return {
              success: false,
              error: "삭제할 대상 옵션의 value 또는 label을 targetOptionValue로 전달해 주세요.",
            };
          }
          const normTarget = targetOptionValue.trim().toLowerCase();
          updatedOptions = updatedOptions.filter(
            (opt) =>
              opt.value.toLowerCase() !== normTarget && opt.label.toLowerCase() !== normTarget
          );
          break;
        }

        case "SET_OPTIONS": {
          if (!newOptionsInput) {
            return {
              success: false,
              error: "전체 교체할 옵션 목록(options)을 전달해 주세요.",
            };
          }
          // 보호 대상 폼에서는 새 목록에서 누락된 기존 옵션을 disabled: true로 보존 병합합니다.
          updatedOptions = isProtected
            ? mergeOptionsWithPreservation(existingOptions, newOptionsInput)
            : normalizeSelectOptions(newOptionsInput);
          break;
        }
      }

      const updatedField: CoreFormField = {
        ...targetField,
        options: updatedOptions,
      };

      const updatedFields = [...currentFields];
      updatedFields[targetFieldIndex] = updatedField;

      const currentPrimaryFieldId = extractPrimaryFieldId(existing);
      if (!currentPrimaryFieldId) {
        return {
          success: false,
          error:
            "현재 폼에 대표 필드(primaryFieldId)가 지정되어 있지 않습니다. 먼저 SET_PRIMARY_FIELD로 대표 필드를 지정해 주세요.",
        };
      }

      const updatedForm = await deps.updateFormById(existing.id, {
        schemaDefinition: {
          primaryFieldId: currentPrimaryFieldId,
          fields: updatedFields,
        },
      });

      const action: NavigatorBuilderAction = {
        type: "UPDATE_SCHEMA",
        operation: "UPDATE_FIELD",
        formId: existing.id,
        primaryFieldId: currentPrimaryFieldId,
        field: updatedField,
        message: `'${targetField.label}' 필드의 옵션을 성공적으로 변경했습니다.`,
      };

      return {
        success: true,
        field: updatedField,
        operation,
        optionsCount: updatedOptions.length,
        updatedForm,
        clientAction: action,
      };
    },
  });

  return {
    navigate: navigateTool,
    createForm: createFormTool,
    updateSchema: updateSchemaTool,
    publishForm: publishFormTool,
    deleteForms: deleteFormsTool,
    addRelationField: addRelationFieldTool,
    updateFieldOptions: updateFieldOptionsTool,
  };
}
