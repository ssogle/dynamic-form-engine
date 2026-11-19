import { tool } from "ai";
import {
  extractActiveFields,
  validateSubmissionData,
  type CoreFormField,
  type Form,
} from "@/entities/form";
import type { FormSubmission, QuerySubmissionsForAnalysisInput } from "@/entities/form-submission";
import type { AnalysisRecordsResult, AnalyticsResult } from "@/entities/form-submission/server";
import { serializeFieldFiltersParam, validateFiltersAgainstFields } from "@/shared/schema";
import {
  consumerApplySubmissionListQueryInputSchema,
  consumerDeleteSubmissionsInputSchema,
  consumerFillFieldsInputSchema,
  consumerNavigateInputSchema,
  consumerSearchSubmissionsInputSchema,
  consumerSubmitFormInputSchema,
  relationRecordIdSchema,
  type ConsumerApplySubmissionListQueryInput,
  type ConsumerDeleteSubmissionsInput,
  type ConsumerFillFieldsInput,
  type ConsumerNavigateInput,
  type ConsumerSearchSubmissionsInput,
  type ConsumerSubmitFormInput,
} from "../../schema/navigator-tools.schema";
import type { NavigatorConsumerAction } from "../../types/navigator-action.types";

export {
  consumerApplySubmissionListQueryInputSchema,
  consumerDeleteSubmissionsInputSchema,
  consumerFillFieldsInputSchema,
  consumerNavigateInputSchema,
  consumerSearchSubmissionsInputSchema,
  consumerSubmitFormInputSchema,
};

/**
 * 컨슈머 URL 경로 정규화 유틸리티
 */
export function normalizeConsumerPath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (trimmed.startsWith("/")) return trimmed;
  return `/${trimmed}`;
}

/**
 * 컨슈머 도구 카탈로그에서 사용할 데이터 의존성 인터페이스
 */
export interface ConsumerToolsDependencies {
  softDeleteSubmissionsByIds: (ids: string[]) => Promise<FormSubmission[]>;
  findFormById: (id: string) => Promise<Form | undefined>;
  queryFormSubmissionsForAnalysis: (
    input: QuerySubmissionsForAnalysisInput
  ) => Promise<AnalyticsResult<AnalysisRecordsResult>>;
  /** 현재 화면 컨텍스트의 활성 폼 ID */
  currentFormId?: string | undefined;
  /** 현재 화면의 기존/임시 입력값 스냅샷 */
  initialDraftValues?: Record<string, unknown> | undefined;
}

const SYSTEM_SORT_FIELDS = new Set(["id", "createdAt", "updatedAt"]);

/**
 * 활성 옵션 목록에서 입력된 코드(value) 또는 표시명(label)을 불변 코드값(value)으로 정규화합니다.
 */
function resolveActiveOptionValue(field: CoreFormField, rawItem: string): string | null {
  const activeOptions = (field.options ?? []).filter((opt) => !opt.disabled);
  const trimmed = rawItem.trim();
  const byValue = activeOptions.find((opt) => opt.value === trimmed);
  if (byValue) return byValue.value;

  const byLabel = activeOptions.find((opt) => opt.label.trim() === trimmed);
  if (byLabel) return byLabel.value;

  return null;
}

/**
 * fillFields 입력을 대상 폼 스키마에 맞게 정규화·검증합니다.
 */
function normalizeAndValidateFillFields(
  activeFields: CoreFormField[],
  rawFields: Record<string, unknown>
): { data: Record<string, unknown>; error: null } | { data: null; error: string } {
  const byId = new Map(activeFields.map((f) => [f.id, f]));
  const byLabel = new Map(activeFields.map((f) => [f.label.trim(), f]));
  const normalized: Record<string, unknown> = {};

  for (const [rawKey, rawVal] of Object.entries(rawFields)) {
    const field = byId.get(rawKey) ?? byLabel.get(rawKey.trim());
    if (!field) {
      return {
        data: null,
        error: `'${rawKey}' 필드는 현재 폼의 활성 스키마에 존재하지 않습니다.`,
      };
    }

    if (rawVal === undefined) continue;

    if (field.type === "select") {
      const items = Array.isArray(rawVal)
        ? rawVal.map((v) => String(v))
        : rawVal === null || rawVal === ""
          ? []
          : [String(rawVal)];

      if (!field.multiple && items.length > 1) {
        return {
          data: null,
          error: `'${field.label}' 필드는 단일 선택만 가능합니다.`,
        };
      }

      const resolvedItems: string[] = [];
      for (const item of items) {
        const resolved = resolveActiveOptionValue(field, item);
        if (!resolved) {
          const allowed = (field.options ?? [])
            .filter((opt) => !opt.disabled)
            .map((opt) => `${opt.label}(${opt.value})`)
            .join(", ");
          return {
            data: null,
            error: `'${field.label}' 필드에 허용되지 않은 선택지('${item}')가 전달되었습니다. 허용 선택지: [${allowed}]`,
          };
        }
        resolvedItems.push(resolved);
      }
      normalized[field.id] = resolvedItems;
      continue;
    }

    if (field.type === "radio") {
      const candidate = Array.isArray(rawVal)
        ? rawVal[0] !== undefined
          ? String(rawVal[0])
          : ""
        : rawVal === null
          ? ""
          : String(rawVal);

      if (candidate.trim() === "") {
        normalized[field.id] = "";
        continue;
      }

      const resolved = resolveActiveOptionValue(field, candidate);
      if (!resolved) {
        const allowed = (field.options ?? [])
          .filter((opt) => !opt.disabled)
          .map((opt) => `${opt.label}(${opt.value})`)
          .join(", ");
        return {
          data: null,
          error: `'${field.label}' 필드에 허용되지 않은 선택지('${candidate}')가 전달되었습니다. 허용 선택지: [${allowed}]`,
        };
      }
      normalized[field.id] = resolved;
      continue;
    }

    if (field.type === "checkbox" && field.options && field.options.length > 0) {
      const items = Array.isArray(rawVal)
        ? rawVal.map((v) => String(v))
        : rawVal === null || rawVal === ""
          ? []
          : [String(rawVal)];

      const resolvedItems: string[] = [];
      for (const item of items) {
        const resolved = resolveActiveOptionValue(field, item);
        if (!resolved) {
          const allowed = field.options
            .filter((opt) => !opt.disabled)
            .map((opt) => `${opt.label}(${opt.value})`)
            .join(", ");
          return {
            data: null,
            error: `'${field.label}' 필드에 허용되지 않은 선택지('${item}')가 전달되었습니다. 허용 선택지: [${allowed}]`,
          };
        }
        resolvedItems.push(resolved);
      }
      normalized[field.id] = resolvedItems;
      continue;
    }

    if (field.type === "relation") {
      const items = Array.isArray(rawVal)
        ? rawVal.map((v) => String(v).trim()).filter(Boolean)
        : rawVal === null || rawVal === ""
          ? []
          : [String(rawVal).trim()].filter(Boolean);

      if (!field.relationConfig?.multiple && items.length > 1) {
        return {
          data: null,
          error: `'${field.label}' 관계형 필드는 최대 1개의 레코드만 선택할 수 있습니다.`,
        };
      }

      for (const item of items) {
        if (!relationRecordIdSchema.safeParse(item).success) {
          return {
            data: null,
            error: `관계형 필드 '${field.label}'에는 타깃 레코드의 유효한 UUID가 필요합니다. (입력값: '${item}')`,
          };
        }
      }
      normalized[field.id] = items;
      continue;
    }

    normalized[field.id] = rawVal;
  }

  return { data: normalized, error: null };
}

/**
 * AI Consumer Navigator 전용 Vercel AI SDK 브라우저 제어 도구 카탈로그 생성 함수
 *
 * 화면 이동, 폼 필드 입력(옵션 정규화/검증), 최종 제출(선검증), 목록 필터·정렬 제어,
 * 그리고 기제출 응답 다건 소프트 삭제를 담당합니다.
 */
export function createConsumerTools(deps: ConsumerToolsDependencies) {
  let trackedDraftValues: Record<string, unknown> = {
    ...(deps.initialDraftValues ?? {}),
  };

  async function resolvePublishedForm(
    requestedFormId?: string
  ): Promise<{ form: Form; error: null } | { form: null; error: string }> {
    const targetFormId = requestedFormId ?? deps.currentFormId;
    if (!targetFormId) {
      return {
        form: null,
        error: "대상 폼 ID를 확인할 수 없습니다. 먼저 'searchForms'로 대상 폼을 조회해 주세요.",
      };
    }

    const form = await deps.findFormById(targetFormId);
    if (!form || !form.publishedAt) {
      return {
        form: null,
        error: `발행된 대상 폼('${targetFormId}')을 찾을 수 없습니다.`,
      };
    }

    return { form, error: null };
  }

  const navigateTool = tool({
    description:
      "컨슈머 포털 내의 다른 화면으로 이동합니다. 특정 폼의 데이터 목록 페이지(/consumer/forms/[id]), 신규 작성 페이지(/consumer/forms/[id]/new), 단건 응답 상세 페이지(/consumer/forms/[id]/submissions/[submissionId]), 응답 수정 페이지(/consumer/forms/[id]/submissions/[submissionId]/edit), 컨슈머 통합 목록(/consumer) 등으로 이동할 때 호출합니다.",
    inputSchema: consumerNavigateInputSchema,
    execute: async ({ targetPath, reason }: ConsumerNavigateInput) => {
      const normalized = normalizeConsumerPath(targetPath);
      const action: NavigatorConsumerAction = {
        type: "NAVIGATE",
        targetPath: normalized,
        message: reason || "해당 화면으로 이동합니다.",
      };
      return {
        success: true,
        targetPath: normalized,
        message: reason,
        clientAction: action,
      };
    },
  });

  const fillFieldsTool = tool({
    description:
      "엔드유저의 자연어 발화에서 입력값을 추출하여 현재 활성 폼의 지정 필드(field.id)에 자동으로 채워 넣거나, 기존 응답 수정 시 필드값을 변경합니다. 여러 필드를 한 번에 채울 수 있습니다.",
    inputSchema: consumerFillFieldsInputSchema,
    execute: async ({ formId, fields, message }: ConsumerFillFieldsInput) => {
      const formResult = await resolvePublishedForm(formId);
      if (formResult.error !== null) {
        return {
          success: false,
          error: formResult.error,
        };
      }

      const activeFields = extractActiveFields(formResult.form);
      const normalizedResult = normalizeAndValidateFillFields(activeFields, fields);
      if (normalizedResult.error !== null) {
        return {
          success: false,
          error: normalizedResult.error,
        };
      }

      trackedDraftValues = {
        ...trackedDraftValues,
        ...normalizedResult.data,
      };

      const action: NavigatorConsumerAction = {
        type: "FILL_FIELDS",
        formId: formResult.form.id,
        fields: normalizedResult.data,
        message,
      };
      return {
        success: true,
        formId: formResult.form.id,
        fields: normalizedResult.data,
        message,
        clientAction: action,
      };
    },
  });

  const submitFormTool = tool({
    description:
      "현재 작성 중인 폼의 입력을 완료하고 최종 제출을 실행하거나, 수정된 응답 저장을 발동합니다. 실행 전 대상 폼 스키마 기준으로 필수 항목과 형식을 선검증합니다.",
    inputSchema: consumerSubmitFormInputSchema,
    execute: async ({ formId, confirmationMessage }: ConsumerSubmitFormInput) => {
      const formResult = await resolvePublishedForm(formId);
      if (formResult.error !== null) {
        return {
          success: false,
          error: formResult.error,
        };
      }

      const activeFields = extractActiveFields(formResult.form);
      const validation = validateSubmissionData(activeFields, trackedDraftValues);
      if (!validation.isValid) {
        return {
          success: false,
          error:
            "필수 입력 항목이 누락되었거나 입력 형식이 올바르지 않아 제출할 수 없습니다. 누락된 항목을 확인해 보완해 주세요.",
          fieldErrors: validation.errors,
        };
      }

      const action: NavigatorConsumerAction = {
        type: "SUBMIT_FORM",
        formId: formResult.form.id,
        message: confirmationMessage,
      };
      return {
        success: true,
        formId: formResult.form.id,
        message: confirmationMessage,
        clientAction: action,
      };
    },
  });

  const deleteSubmissionsTool = tool({
    description:
      "특정 폼의 제출 응답 내역들을 소프트 삭제합니다. 응답 목록 화면에서 단일 또는 복수의 응답을 삭제할 때 호출합니다.",
    inputSchema: consumerDeleteSubmissionsInputSchema,
    execute: async ({ submissionIds, reason }: ConsumerDeleteSubmissionsInput) => {
      const deleted = await deps.softDeleteSubmissionsByIds(submissionIds);
      const action: NavigatorConsumerAction = {
        type: "DELETE_SUBMISSIONS",
        deletedIds: deleted.map((s) => s.id),
        message: reason ?? "선택한 응답을 성공적으로 삭제했습니다.",
      };
      return {
        success: true,
        deletedIds: action.deletedIds,
        deletedCount: deleted.length,
        reason: reason ?? "사용자 요청에 의한 응답 삭제",
        clientAction: action,
      };
    },
  });

  const applySubmissionListQueryTool = tool({
    description:
      "특정 폼의 응답 목록(/consumer/forms/[id])에 컬럼 필터, 기간 범위 필터, 다중 정렬을 적용하거나 전체 초기화(reset: true)합니다.",
    inputSchema: consumerApplySubmissionListQueryInputSchema,
    execute: async ({
      formId,
      filters,
      dateRange,
      sort,
      reset,
      reason,
    }: ConsumerApplySubmissionListQueryInput) => {
      const formResult = await resolvePublishedForm(formId);
      if (formResult.error !== null) {
        return {
          success: false,
          error: formResult.error,
        };
      }

      const basePath = `/consumer/forms/${formResult.form.id}`;
      if (reset) {
        const message = reason ?? "적용된 필터와 정렬 조건을 초기화했습니다.";
        const action: NavigatorConsumerAction = {
          type: "NAVIGATE",
          targetPath: basePath,
          message,
        };
        return {
          success: true,
          targetPath: basePath,
          clientAction: action,
        };
      }

      const activeFields = extractActiveFields(formResult.form);
      const searchParams = new URLSearchParams();

      if (filters && filters.length > 0) {
        const filterValidation = validateFiltersAgainstFields(filters, activeFields, {
          allowSystemFields: true,
        });
        if (filterValidation.error !== null) {
          return {
            success: false,
            error: filterValidation.error,
          };
        }
        const serialized = serializeFieldFiltersParam(filterValidation.data);
        if (serialized) {
          searchParams.set("filters", serialized);
        }
      }

      if (dateRange) {
        if (dateRange.startDate && dateRange.endDate && dateRange.startDate > dateRange.endDate) {
          return {
            success: false,
            error: "기간 필터의 종료일(endDate)은 시작일(startDate)보다 같거나 이후여야 합니다.",
          };
        }
        if (dateRange.dateFieldId) {
          const dateField = activeFields.find(
            (f) => f.id === dateRange.dateFieldId && f.type === "date"
          );
          if (!dateField) {
            return {
              success: false,
              error: `날짜 기준 필드('${dateRange.dateFieldId}')는 유효한 날짜형(date) 필드가 아닙니다.`,
            };
          }
          searchParams.set("dateFieldId", dateField.id);
        }
        if (dateRange.startDate) searchParams.set("startDate", dateRange.startDate);
        if (dateRange.endDate) searchParams.set("endDate", dateRange.endDate);
      }

      if (sort && sort.length > 0) {
        const activeFieldIds = new Set(activeFields.map((f) => f.id));
        for (const item of sort) {
          if (!SYSTEM_SORT_FIELDS.has(item.id) && !activeFieldIds.has(item.id)) {
            return {
              success: false,
              error: `정렬 대상 컬럼('${item.id}')이 폼 스키마에 존재하지 않습니다.`,
            };
          }
        }
        const sortStr = sort.map((s) => `${s.id}:${s.desc ? "desc" : "asc"}`).join(",");
        if (sortStr !== "createdAt:desc") {
          searchParams.set("sort", sortStr);
        }
      }

      const qs = searchParams.toString();
      const targetPath = qs ? `${basePath}?${qs}` : basePath;
      const message = reason ?? "요청하신 조건으로 목록을 조회했습니다.";
      const action: NavigatorConsumerAction = {
        type: "NAVIGATE",
        targetPath,
        message,
      };

      return {
        success: true,
        targetPath,
        clientAction: action,
      };
    },
  });

  const searchSubmissionsTool = tool({
    description:
      "발행된 폼에 등록된 제출 데이터 레코드(id, createdAt, 라벨 매핑된 values)를 화면 이동 없이 읽기 전용으로 검색·조회합니다. 오늘/기간별 등록 여부 확인, 특정 건 조회, relation 필드에 연결할 타깃 폼 레코드 UUID 탐색에 사용하세요(통계 집계에는 사용하지 않음).",
    inputSchema: consumerSearchSubmissionsInputSchema,
    execute: async ({
      formId,
      dateFieldId,
      startDate,
      endDate,
      filters,
      sortOrder,
      limit,
    }: ConsumerSearchSubmissionsInput) => {
      const formResult = await resolvePublishedForm(formId);
      if (formResult.error !== null) {
        return {
          success: false,
          error: formResult.error,
        };
      }

      try {
        // 요청 상한(limit)보다 1건 더 조회하여 추가 데이터 존재 여부(hasMore)를 판별합니다.
        const result = await deps.queryFormSubmissionsForAnalysis({
          formId: formResult.form.id,
          dateFieldId,
          startDate,
          endDate,
          timezone: "Asia/Seoul",
          filters,
          sortOrder,
          limit: limit + 1,
        });
        if (result.error !== null) {
          return {
            success: false,
            error: result.error,
          };
        }

        const hasMore = result.data.records.length > limit;
        const records = hasMore ? result.data.records.slice(0, limit) : result.data.records;

        return {
          success: true,
          data: {
            ...result.data,
            totalReturned: records.length,
            hasMore,
            records,
          },
        };
      } catch (err) {
        console.error("searchSubmissions 실행 오류:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "제출 데이터 조회 중 오류가 발생했습니다.",
        };
      }
    },
  });

  return {
    navigate: navigateTool,
    fillFields: fillFieldsTool,
    submitForm: submitFormTool,
    deleteSubmissions: deleteSubmissionsTool,
    applySubmissionListQuery: applySubmissionListQueryTool,
    searchSubmissions: searchSubmissionsTool,
  };
}
