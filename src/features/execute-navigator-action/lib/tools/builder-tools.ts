import { tool } from "ai";
import { z } from "zod";
import {
  coreFormFieldSchema,
  extractActiveFields,
  type CoreFormField,
  type Form,
  type InsertForm,
  type UpdateForm,
} from "@/entities/form";
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
    .describe("생성할 초기 필드 배열 (text, textarea, number, select)"),
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
        updatedFields = newFieldsList;
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
          options: fieldData.options ?? undefined,
        };
        updatedFields.push(newField);
      } else if (operation === "REMOVE_FIELD") {
        if (!targetFieldId) {
          return {
            success: false,
            error: "필드 삭제 시 대상 targetFieldId는 필수입니다.",
          };
        }
        updatedFields = updatedFields.filter((f) => !matchesTargetField(f, targetFieldId));
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

  return {
    navigate: navigateTool,
    createForm: createFormTool,
    updateSchema: updateSchemaTool,
    publishForm: publishFormTool,
    deleteForms: deleteFormsTool,
  };
}
