import { tool } from "ai";
import { z } from "zod";
import {
  coreFormFieldSchema,
  type CoreFormField,
  type Form,
  type InsertForm,
  type UpdateForm,
} from "@/entities/form";
import type { NavigatorBuilderAction, SchemaOperation } from "../../types/navigator-action.types";
import { nowUtcIso } from "@/shared/lib/date";

export const slugRegex = /^[a-z0-9-]+$/;

/**
 * 임의의 문자열을 URL 호환 슬러그 규격(영문 소문자, 숫자, 하이픈)으로 정제
 */
export function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

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
 * 필드 ID, name, label 중 하나라도 일치하는지 지능적으로 대조하는 판별 함수
 */
function matchesTargetField(field: CoreFormField, targetIdentifier?: string): boolean {
  if (!targetIdentifier) return false;
  const normTarget = targetIdentifier.trim().toLowerCase().replace(/\s+/g, "");
  const normId = field.id.trim().toLowerCase().replace(/\s+/g, "");
  const normName = field.name.trim().toLowerCase().replace(/\s+/g, "");
  const normLabel = field.label.trim().toLowerCase().replace(/\s+/g, "");

  return (
    normId === normTarget ||
    normName === normTarget ||
    normLabel === normTarget ||
    normTarget.includes(normLabel) ||
    normLabel.includes(normTarget)
  );
}

/**
 * 빌더 변경/제어 도구 카탈로그에서 사용할 DB 저장소 의존성 인터페이스
 */
export interface BuilderToolsDependencies {
  findFormBySlug: (slug: string) => Promise<Form | undefined>;
  insertForm: (input: InsertForm) => Promise<Form>;
  updateFormById: (id: string, updates: UpdateForm) => Promise<Form | undefined>;
  softDeleteFormsBySlugs: (slugs: string[]) => Promise<Form[]>;
}

// 1. navigate 입력 스키마
export const navigateInputSchema = z.object({
  targetPath: z
    .string()
    .describe("이동할 절대 경로 (예: /builder/forms, /builder/forms/my-survey)"),
  reason: z.string().optional().describe("이동 사유 또는 목적"),
});

// 2. createForm 입력 스키마
export const createFormInputSchema = z.object({
  slug: z
    .string()
    .min(2, "슬러그는 최소 2글자 이상이어야 합니다.")
    .regex(slugRegex, "슬러그는 영문 소문자, 숫자, 하이픈만 허용됩니다.")
    .describe("URL 슬러그 (예: customer-survey, job-application)"),
  title: z.string().min(1, "폼 제목은 필수입니다.").describe("폼 제목"),
  description: z.string().optional().describe("폼에 대한 설명"),
  fields: z
    .array(coreFormFieldSchema)
    .describe("생성할 초기 필드 배열 (text, textarea, number, select)"),
});

// 3. updateSchema 입력 스키마
export const updateSchemaInputSchema = z.object({
  formSlug: z.string().min(1).describe("수정할 대상 폼의 슬러그"),
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
  newSlug: z.string().optional().describe("변경할 새 폼 슬러그"),
  formTitle: z.string().optional().describe("변경할 폼 제목"),
});

// 4. publishForm 입력 스키마
export const publishFormInputSchema = z.object({
  formSlug: z.string().min(1).describe("발행 상태를 변경할 대상 폼의 슬러그"),
  isPublished: z.boolean().describe("발행 여부 (true: 공개 발행, false: 비발행/초안 회수)"),
});

// 5. deleteForms 입력 스키마
export const deleteFormsInputSchema = z.object({
  formSlugs: z
    .array(z.string().min(1))
    .min(1, "삭제할 폼 슬러그는 최소 1개 이상이어야 합니다.")
    .describe("삭제할 대상 폼의 슬러그 배열 (단일 폼 삭제 시에도 원소가 1개인 배열로 전달)"),
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
      "애플리케이션 내의 다른 화면으로 이동합니다. 폼 목록(/builder/forms), 라이브 캔버스(/builder/forms/[slug]), 뷰 목록(/builder/views) 등으로 이동할 때 호출합니다.",
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
      "새로운 폼을 생성하고 데이터베이스에 영속화합니다. 폼 생성 후 즉시 해당 폼의 라이브 캔버스(/builder/forms/[slug])로 이동하도록 처리됩니다.",
    inputSchema: createFormInputSchema,
    execute: async ({
      slug,
      title,
      description,
      fields,
    }: z.infer<typeof createFormInputSchema>) => {
      const sanitized = sanitizeSlug(slug);
      const existing = await deps.findFormBySlug(sanitized);

      if (existing) {
        return {
          success: false,
          error: `이미 존재하는 슬러그('${sanitized}')입니다. 다른 슬러그를 사용해 주세요.`,
        };
      }

      const created = await deps.insertForm({
        slug: sanitized,
        title,
        description: description ?? null,
        schemaDefinition: { fields },
        publishedAt: null,
      });

      const action: NavigatorBuilderAction = {
        type: "CREATE_FORM",
        slug: created.slug,
        title: created.title,
        description: created.description ?? undefined,
        fields: extractFieldsFromForm(created),
        message: `새로운 폼 '${created.title}'을 생성했습니다.`,
      };

      return {
        success: true,
        form: created,
        targetPath: `/builder/forms/${created.slug}`,
        clientAction: action,
      };
    },
  });

  const updateSchemaTool = tool({
    description:
      "기존 폼의 필드를 추가, 수정, 삭제하거나 전체 필드를 일괄 교체(SET_ALL_FIELDS)합니다.",
    inputSchema: updateSchemaInputSchema,
    execute: async ({
      formSlug,
      operation,
      targetFieldId,
      fieldData,
      fields: newFieldsList,
      newSlug,
      formTitle,
    }: z.infer<typeof updateSchemaInputSchema>) => {
      const existing = await deps.findFormBySlug(formSlug);
      if (!existing) {
        return {
          success: false,
          error: `수정 대상 폼('${formSlug}')을 찾을 수 없습니다.`,
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
        if (!fieldData || !fieldData.name || !fieldData.label || !fieldData.type) {
          return {
            success: false,
            error: "필드 추가 시 name, label, type은 필수입니다.",
          };
        }
        const newField: CoreFormField = {
          id: fieldData.id ?? `f_${Date.now().toString(36)}`,
          name: fieldData.name,
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
            name: fieldData.name ?? f.name,
            label: fieldData.label ?? f.label,
            type: fieldData.type ?? f.type,
            required: fieldData.required ?? f.required,
            id: f.id,
          };
        });
      }

      const updatePayload: UpdateForm = {
        title: formTitle ?? existing.title,
        slug: newSlug ? sanitizeSlug(newSlug) : existing.slug,
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
        field: fieldData as CoreFormField | undefined,
        fields: newFieldsList,
        title: formTitle,
        slug: newSlug,
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
    execute: async ({ formSlug, isPublished }: z.infer<typeof publishFormInputSchema>) => {
      const existing = await deps.findFormBySlug(formSlug);
      if (!existing) {
        return {
          success: false,
          error: `대상 폼('${formSlug}')을 찾을 수 없습니다.`,
        };
      }

      const updated = await deps.updateFormById(existing.id, {
        publishedAt: isPublished ? (nowUtcIso() as unknown as Date) : null,
      });

      const action: NavigatorBuilderAction = {
        type: "PUBLISH_FORM",
        slug: formSlug,
        isPublished,
        message: isPublished
          ? "폼이 공식 발행되었습니다. 응답자가 작성할 수 있습니다."
          : "폼 발행이 취소되어 초안 상태로 회수되었습니다.",
      };

      return {
        success: true,
        formSlug,
        isPublished,
        form: updated,
        clientAction: action,
      };
    },
  });

  const deleteFormsTool = tool({
    description: "지정된 슬러그의 폼을 소프트 삭제합니다.",
    inputSchema: deleteFormsInputSchema,
    execute: async ({ formSlugs, reason }: z.infer<typeof deleteFormsInputSchema>) => {
      const sanitizedSlugs = formSlugs.map(sanitizeSlug);
      const deleted = await deps.softDeleteFormsBySlugs(sanitizedSlugs);

      const action: NavigatorBuilderAction = {
        type: "DELETE_FORMS",
        deletedSlugs: deleted.map((f) => f.slug),
        message: "선택한 폼을 성공적으로 삭제했습니다.",
      };

      return {
        success: true,
        deletedSlugs: deleted.map((f) => f.slug),
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
