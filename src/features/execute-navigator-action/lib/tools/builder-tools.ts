import { tool } from "ai";
import { z } from "zod";
import {
  coreFormFieldSchema,
  extractActiveFields,
  selectOptionSchema,
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
  if (!form || !form.schemaDefinition || typeof form.schemaDefinition !== "object") {
    return [];
  }
  const schema = form.schemaDefinition as { fields?: unknown };
  if (Array.isArray(schema.fields)) {
    return schema.fields as CoreFormField[];
  }
  return [];
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
  insertForm: (input: InsertForm) => Promise<Form>;
  updateFormById: (id: string, updates: UpdateForm) => Promise<Form | undefined>;
  publishFormById: (id: string, isPublished: boolean) => Promise<Form | undefined>;
  softDeleteFormsByIds: (ids: string[]) => Promise<Form[]>;
}

// 1. navigate 입력 스키마
export const navigateInputSchema = z.object({
  targetPath: z.string().describe("이동할 절대 경로 (예: /builder/forms, /builder/forms/[id])"),
  reason: z.string().optional().describe("이동 사유 또는 목적"),
});

// 2. createForm 입력 스키마
export const createFormInputSchema = z.object({
  title: z.string().min(1, "폼 제목은 필수입니다.").describe("폼 제목"),
  description: z.string().optional().describe("폼에 대한 설명"),
  fields: z
    .array(coreFormFieldSchema)
    .describe(
      "생성할 초기 필드 배열 (text, textarea, number, select, radio, checkbox, date, switch, relation, section)"
    ),
});

// 3. updateSchema 입력 스키마
export const updateSchemaInputSchema = z.object({
  formId: z.uuid("수정 대상 폼의 ID(UUID)는 필수입니다.").describe("수정할 대상 폼의 고유 ID"),
  operation: z
    .enum(["ADD_FIELD", "REMOVE_FIELD", "MODIFY_FIELD", "UPDATE_INFO", "SET_ALL_FIELDS"])
    .describe("수행할 스키마 조작 유형 (다중 수정이나 복합 필드 변경 시에는 SET_ALL_FIELDS 사용)"),
  targetFieldId: z
    .string()
    .optional()
    .describe("수정/삭제 대상 필드 식별자 (단일 필드 ADD/REMOVE/MODIFY 시 사용)"),
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
  displayField: z
    .string()
    .optional()
    .describe(
      "타깃 폼에서 콤보박스 선택지로 노출할 대표 필드 ID (생략 시 타깃 폼의 첫 번째 텍스트 계열 필드를 자동 탐색하여 지정)"
    ),
  multiple: z
    .boolean()
    .default(false)
    .describe("다중 선택 허용 여부 (기본값: false - 단일 레코드 참조)"),
  required: z.boolean().default(false).describe("필수 선택 여부"),
  description: z.string().optional().describe("필드 부가 설명"),
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
    execute: async ({ title, description, fields }: z.infer<typeof createFormInputSchema>) => {
      const created = await deps.insertForm({
        title,
        description: description ?? null,
        schemaDefinition: { fields },
      });

      const action: NavigatorBuilderAction = {
        type: "CREATE_FORM",
        formId: created.id,
        title: created.title,
        description: created.description ?? undefined,
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
      "기존 폼의 필드를 추가, 수정, 삭제하거나 전체 필드를 일괄 교체(SET_ALL_FIELDS)합니다.",
    inputSchema: updateSchemaInputSchema,
    execute: async ({
      formId,
      operation,
      targetFieldId,
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
      let updatedFields: CoreFormField[] = [...currentFields];

      if (operation === "SET_ALL_FIELDS") {
        if (!newFieldsList) {
          return {
            success: false,
            error: "SET_ALL_FIELDS 오퍼레이션에는 완성된 fields 배열이 필수입니다.",
          };
        }

        const nowIso = nowUtcIso();
        const newFieldIdSet = new Set(newFieldsList.map((f) => f.id));

        // 기존 필드 중 newFieldsList에 누락된 필드들을 소프트 삭제(deletedAt) 상태로 보존하여 과거 데이터 무결성을 유지합니다.
        const preservedDeletedFields: CoreFormField[] = currentFields
          .filter((oldField) => !newFieldIdSet.has(oldField.id))
          .map((oldField) => ({
            ...oldField,
            deletedAt: oldField.deletedAt ?? nowIso,
          }));

        updatedFields = [...newFieldsList, ...preservedDeletedFields];
      } else if (operation === "ADD_FIELD") {
        if (!fieldData || !fieldData.label || !fieldData.type) {
          return {
            success: false,
            error: "필드 추가 시 label, type은 필수입니다.",
          };
        }
        const newField: CoreFormField = {
          id: fieldData.id ?? `f_${Date.now().toString(36)}`,
          label: fieldData.label,
          type: fieldData.type,
          required: fieldData.required ?? false,
          placeholder: fieldData.placeholder ?? undefined,
          description: fieldData.description ?? undefined,
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

        const nowIso = nowUtcIso();
        let targetFound = false;

        // 과거 기제출 데이터의 라벨 무결성 보존을 위해 물리 삭제 대신 소프트 삭제(deletedAt)로 처리합니다.
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
      } else if (operation === "MODIFY_FIELD") {
        if (!targetFieldId || !fieldData) {
          return {
            success: false,
            error: "필드 수정 시 targetFieldId와 fieldData는 필수입니다.",
          };
        }

        updatedFields = updatedFields.map((f): CoreFormField => {
          if (!matchesTargetField(f, targetFieldId)) return f;
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
            options: fieldData.options !== undefined ? fieldData.options : f.options,
            relationConfig:
              fieldData.relationConfig !== undefined ? fieldData.relationConfig : f.relationConfig,
            id: f.id,
          };
        });
      }

      const updatePayload: UpdateForm = {
        title: formTitle ?? existing.title,
        schemaDefinition: { fields: updatedFields },
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
      "현재 폼에 다른 도메인 폼을 참조하는 관계형 필드(type: 'relation')를 추가합니다. 타깃 폼을 스캔하여 대표 필드를 콤보박스에 바인딩합니다.",
    inputSchema: addRelationFieldInputSchema,
    execute: async ({
      formId,
      label,
      targetFormId,
      displayField: inputDisplayField,
      multiple,
      required,
      description,
    }: z.infer<typeof addRelationFieldInputSchema>) => {
      // 1. 현재 작업 중인 폼 유효성 검증
      const currentForm = await deps.findFormById(formId);
      if (!currentForm) {
        return {
          success: false,
          error: `현재 작업 대상 폼('${formId}')을 찾을 수 없습니다.`,
        };
      }

      // 2. 참조 대상 타깃 폼 존재 여부 및 필드 검증
      const targetForm = await deps.findFormById(targetFormId);
      if (!targetForm) {
        return {
          success: false,
          error: `참조 대상 타깃 폼('${targetFormId}')을 찾을 수 없습니다. 올바른 폼 ID인지 확인해 주세요.`,
        };
      }

      const targetFields = extractFieldsFromForm(targetForm);
      let resolvedDisplayField = inputDisplayField;

      // 대표 필드가 명시되지 않은 경우, 타깃 폼의 필드 중 적합한 텍스트/라벨 계열 필드를 자동 탐색
      if (!resolvedDisplayField) {
        const candidateField =
          targetFields.find((f) => f.type === "text" || f.type === "textarea") ?? targetFields[0];

        if (!candidateField) {
          return {
            success: false,
            error: `참조 대상 폼 '${targetForm.title}'에 대표 필드로 노출할 필드가 존재하지 않습니다.`,
          };
        }
        resolvedDisplayField = candidateField.id;
      } else {
        // 명시된 displayField가 타깃 폼에 존재하는지 검증 (ID 또는 라벨 매칭)
        const matched = targetFields.find((f) => matchesTargetField(f, resolvedDisplayField));
        if (matched) {
          resolvedDisplayField = matched.id;
        }
      }

      const currentFields = extractFieldsFromForm(currentForm);
      const newFieldId = `f_rel_${Date.now().toString(36)}`;
      const newField: CoreFormField = {
        id: newFieldId,
        label,
        type: "relation",
        required: required ?? false,
        description: description ?? `'${targetForm.title}' 폼을 참조하는 관계형 필드`,
        relationConfig: {
          targetFormId: targetForm.id,
          displayField: resolvedDisplayField,
          multiple: multiple ?? false,
        },
      };

      const updatedFields = [...currentFields, newField];
      const updated = await deps.updateFormById(currentForm.id, {
        schemaDefinition: { fields: updatedFields },
      });

      const action: NavigatorBuilderAction = {
        type: "UPDATE_SCHEMA",
        operation: "ADD_FIELD",
        formId: currentForm.id,
        field: newField,
        message: `'${targetForm.title}' 폼을 참조하는 관계형 필드 '${label}'을 추가했습니다.`,
      };

      return {
        success: true,
        field: newField,
        targetFormTitle: targetForm.title,
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

      // 기존 옵션 목록을 SelectOption[] 형태로 정규화
      const existingOptions: SelectOption[] = (targetField.options ?? []).map((opt) =>
        typeof opt === "string"
          ? { label: opt, value: opt, disabled: false }
          : { label: opt.label, value: opt.value, disabled: Boolean(opt.disabled) }
      );

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
              updatedOptions.push({
                label: opt.label,
                value: opt.value,
                disabled: Boolean(opt.disabled),
              });
              existingValues.add(opt.value);
            }
          }
          break;
        }

        case "REMOVE_OPTION": {
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
          updatedOptions = newOptionsInput.map((opt) => ({
            label: opt.label,
            value: opt.value,
            disabled: Boolean(opt.disabled),
          }));
          break;
        }
      }

      const updatedField: CoreFormField = {
        ...targetField,
        options: updatedOptions,
      };

      const updatedFields = [...currentFields];
      updatedFields[targetFieldIndex] = updatedField;

      const updatedForm = await deps.updateFormById(existing.id, {
        schemaDefinition: { fields: updatedFields },
      });

      const action: NavigatorBuilderAction = {
        type: "UPDATE_SCHEMA",
        operation: "UPDATE_FIELD",
        formId: existing.id,
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
