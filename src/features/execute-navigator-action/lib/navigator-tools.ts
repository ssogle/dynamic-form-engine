import { tool } from "ai";
import { z } from "zod";
import {
  coreFormFieldSchema,
  type CoreFormField,
  type Form,
  type InsertForm,
  type UpdateForm,
} from "@/entities/form";
import { slugRegex } from "../types/action.types";
import { sanitizeSlug } from "../lib/action-parser";

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
 * 도구 카탈로그에서 사용할 DB 저장소 의존성 인터페이스
 */
export interface NavigatorToolsDependencies {
  findActiveForms: () => Promise<Form[]>;
  findFormBySlug: (slug: string) => Promise<Form | undefined>;
  insertForm: (input: InsertForm) => Promise<Form>;
  updateFormById: (id: string, updates: UpdateForm) => Promise<Form | undefined>;
  softDeleteFormById: (id: string) => Promise<Form | undefined>;
}

// 1. navigate 입력 스키마
const navigateInputSchema = z.object({
  targetPath: z
    .string()
    .describe("이동할 절대 경로 (예: /builder/forms, /builder/forms/my-survey)"),
  reason: z.string().optional().describe("이동 사유 또는 목적"),
});

// 2. listForms 입력 스키마
const listFormsInputSchema = z.object({});

// 3. createForm 입력 스키마
const createFormInputSchema = z.object({
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

// 4. updateSchema 입력 스키마
const updateSchemaInputSchema = z.object({
  formSlug: z.string().min(1).describe("수정할 대상 폼의 슬러그"),
  operation: z
    .enum(["ADD_FIELD", "REMOVE_FIELD", "MODIFY_FIELD", "UPDATE_INFO"])
    .describe("수행할 스키마 조작 유형"),
  targetFieldId: z
    .string()
    .optional()
    .describe("수정/삭제 대상 필드 식별자 (필드 ID, name 또는 라벨)"),
  fieldData: coreFormFieldSchema.partial().optional().describe("추가 또는 변경할 필드 데이터"),
  formTitle: z.string().optional().describe("변경할 폼 제목"),
  formDescription: z.string().optional().describe("변경할 폼 설명"),
});

// 5. deleteForm 입력 스키마
const deleteFormInputSchema = z.object({
  formSlug: z.string().min(1).describe("삭제할 대상 폼의 고유 슬러그 또는 식별자"),
});

/**
 * Vercel AI SDK 호환 AI Navigator 도구 카탈로그 생성 팩토리
 *
 * @param deps 데이터베이스 접근 함수들 (의존성 주입)
 * @returns navigate, createForm, updateSchema, listForms 도구 맵
 */
export function createNavigatorTools(deps: NavigatorToolsDependencies) {
  return {
    navigate: tool({
      description:
        "지정된 애플리케이션 화면 경로로 라우팅 이동을 지시합니다. (예: /builder/forms, /builder/views, /consumer, /builder/forms/[slug])",
      inputSchema: navigateInputSchema,
      execute: async ({ targetPath }: z.infer<typeof navigateInputSchema>) => {
        return {
          success: true,
          targetPath,
        };
      },
    }),

    listForms: tool({
      description:
        "시스템에 현재 등록되어 있는 모든 활성 폼 목록(슬러그, 제목, 필드 수 등)을 조회합니다.",
      inputSchema: listFormsInputSchema,
      execute: async () => {
        const forms = await deps.findActiveForms();
        return {
          success: true,
          forms: forms.map((form) => ({
            slug: form.slug,
            title: form.title,
            fieldCount: extractFieldsFromForm(form).length,
          })),
        };
      },
    }),

    createForm: tool({
      description: "새로운 동적 폼을 데이터베이스에 생성하고 라이브 캔버스로 진입합니다.",
      inputSchema: createFormInputSchema,
      execute: async ({
        slug,
        title,
        description,
        fields,
      }: z.infer<typeof createFormInputSchema>) => {
        const cleanSlug = sanitizeSlug(slug);
        const created = await deps.insertForm({
          slug: cleanSlug,
          title,
          description: description ?? null,
          schemaDefinition: { fields: fields ?? [] },
        });

        const createdFields = extractFieldsFromForm(created);

        return {
          success: true,
          slug: created.slug,
          title: created.title,
          fieldCount: createdFields.length,
        };
      },
    }),

    updateSchema: tool({
      description:
        "현재 작업 중인 폼의 스키마(필드 추가, 수정, 삭제) 또는 메타데이터(제목, 설명)를 수정합니다.",
      inputSchema: updateSchemaInputSchema,
      execute: async ({
        formSlug,
        operation,
        targetFieldId,
        fieldData,
        formTitle,
        formDescription,
      }: z.infer<typeof updateSchemaInputSchema>) => {
        const existingForm = await deps.findFormBySlug(formSlug);
        if (!existingForm) {
          return {
            success: false,
            error: `슬러그가 '${formSlug}'인 폼을 찾을 수 없습니다.`,
          };
        }

        const currentFields = extractFieldsFromForm(existingForm);
        let updatedFields: CoreFormField[] = [...currentFields];

        if (operation === "ADD_FIELD" && fieldData) {
          const newField: CoreFormField = {
            id: fieldData.id ?? `field_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: fieldData.name ?? `field_${Date.now()}`,
            label: fieldData.label ?? "새 입력 항목",
            type: fieldData.type ?? "text",
            required: fieldData.required ?? false,
            ...(fieldData.placeholder ? { placeholder: fieldData.placeholder } : {}),
            ...(fieldData.options ? { options: fieldData.options } : {}),
          };
          updatedFields.push(newField);
        } else if (operation === "REMOVE_FIELD" && targetFieldId) {
          updatedFields = updatedFields.filter((f) => !matchesTargetField(f, targetFieldId));
        } else if (operation === "MODIFY_FIELD" && targetFieldId && fieldData) {
          updatedFields = updatedFields.map((f) => {
            if (matchesTargetField(f, targetFieldId)) {
              return {
                id: f.id,
                name: fieldData.name ?? f.name,
                label: fieldData.label ?? f.label,
                type: fieldData.type ?? f.type,
                required: fieldData.required ?? f.required,
                placeholder: fieldData.placeholder ?? f.placeholder,
                ...(fieldData.type === "select" && fieldData.options
                  ? { options: fieldData.options }
                  : f.options
                    ? { options: f.options }
                    : {}),
              };
            }
            return f;
          });
        }

        const updated = await deps.updateFormById(existingForm.id, {
          title: formTitle ?? existingForm.title,
          description: formDescription ?? existingForm.description,
          schemaDefinition: { fields: updatedFields },
        });

        return {
          success: true,
          formSlug: updated?.slug ?? existingForm.slug,
          operation,
          fieldCount: updatedFields.length,
          title: updated?.title ?? existingForm.title,
        };
      },
    }),

    deleteForm: tool({
      description: "지정된 폼을 시스템(데이터베이스)에서 안전하게 소프트 삭제합니다.",
      inputSchema: deleteFormInputSchema,
      execute: async ({ formSlug }: z.infer<typeof deleteFormInputSchema>) => {
        const existingForm = await deps.findFormBySlug(formSlug);
        if (!existingForm) {
          return {
            success: false,
            error: `슬러그가 '${formSlug}'인 폼을 찾을 수 없습니다.`,
          };
        }

        await deps.softDeleteFormById(existingForm.id);

        return {
          success: true,
          formSlug: existingForm.slug,
          title: existingForm.title,
        };
      },
    }),
  };
}
