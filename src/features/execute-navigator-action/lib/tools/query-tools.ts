import { tool } from "ai";
import type { Form } from "@/entities/form";
import { resolveFieldQueryCapability } from "@/shared/schema";
import {
  getFormDetailsInputSchema,
  searchFormsInputSchema,
  type GetFormDetailsInput,
  type SearchFormsInput,
} from "../../schema/navigator-tools.schema";
import { extractFieldsFromForm } from "./builder-tools";

export { getFormDetailsInputSchema, searchFormsInputSchema };

/**
 * 폼 조회 도구 카탈로그에서 사용할 데이터 의존성 인터페이스
 */
export interface QueryToolsDependencies {
  findActiveForms: () => Promise<Form[]>;
  findPublishedForms: () => Promise<Form[]>;
  findFormById: (id: string) => Promise<Form | undefined>;
}

/**
 * AI Navigator용 가벼운 폼 조회 도구(Query Tools) 팩토리 함수
 *
 * 전체 폼 스키마 전량 주입을 방지하고, 에이전트가 필요할 때 폼 목록과 세부 필드 규격을
 * 단계적으로(Coarse-to-Fine) 정밀 조회할 수 있는 서버 실행형 도구를 생성합니다.
 *
 * @param deps 폼 조회를 위한 서버 리포지토리 의존성
 * @returns Vercel AI SDK 호환 도구 맵 (searchForms, getFormDetails)
 */
export function createQueryTools(deps: QueryToolsDependencies) {
  /**
   * 1. 가벼운 식별 메타데이터 중심의 폼 선별 검색 도구
   */
  const searchFormsTool = tool({
    description:
      "등록된 폼 목록을 키워드로 검색하여 폼 ID, 제목, 기본 설명 등의 가벼운 식별 메타데이터를 반환합니다. 무거운 필드 스키마는 포함하지 않습니다.",
    inputSchema: searchFormsInputSchema,
    execute: async ({ keyword, mode = "consumer" }: SearchFormsInput) => {
      const forms =
        mode === "builder" ? await deps.findActiveForms() : await deps.findPublishedForms();

      const trimmed = keyword?.trim().toLowerCase() ?? "";
      const filtered = trimmed
        ? forms.filter((f) => {
            const inTitle = f.title.toLowerCase().includes(trimmed);
            const inDesc = f.description ? f.description.toLowerCase().includes(trimmed) : false;
            return inTitle || inDesc;
          })
        : forms;

      // 가벼운 식별 메타데이터만 선별하여 일치하는 폼 전체 반환 (무거운 스키마 제외)
      return filtered.map((f) => ({
        id: f.id,
        title: f.title,
        description: f.description ?? undefined,
        isPublished: Boolean(f.publishedAt),
      }));
    },
  });

  /**
   * 2. 대상 폼 1개의 상세 필드 스펙 정밀 조회 도구
   */
  const getFormDetailsTool = tool({
    description:
      "특정 폼의 전체 필드 스펙(라벨, 타입, 필수 여부, 선택지)을 정밀 조회합니다. 필드 값을 매핑하거나 스키마 구조를 확인할 때 호출합니다.",
    inputSchema: getFormDetailsInputSchema,
    execute: async ({ formId }: GetFormDetailsInput) => {
      const form = await deps.findFormById(formId);
      if (!form) {
        return {
          found: false,
          message: `'${formId}' ID를 가진 폼을 찾을 수 없습니다.`,
        };
      }

      const activeFields = extractFieldsFromForm(form);

      return {
        found: true,
        id: form.id,
        title: form.title,
        description: form.description ?? undefined,
        isPublished: Boolean(form.publishedAt),
        fields: activeFields.map((f) => {
          const capability = resolveFieldQueryCapability(f);
          return {
            id: f.id,
            label: f.label,
            type: f.type,
            required: Boolean(f.required),
            options: f.options ?? undefined,
            capabilities: capability
              ? {
                  filterOperators: capability.filterOperators,
                  aggregatableMetrics: capability.aggregatableMetrics,
                  groupable: capability.groupable,
                  isDateAxisCandidate: capability.isDateAxisCandidate,
                }
              : undefined,
          };
        }),
      };
    },
  });

  return {
    searchForms: searchFormsTool,
    getFormDetails: getFormDetailsTool,
  };
}
