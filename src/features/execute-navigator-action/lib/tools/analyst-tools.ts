import { tool } from "ai";
import { z } from "zod";
import {
  analysisBlockSchema,
  extractAnalysisBlocks,
  type AnalysisBlock,
  type AnalysisView,
  type InsertAnalysisView,
  type UpdateAnalysisView,
} from "@/entities/analysis-view";
import {
  analyticsAggregationQuerySchema,
  computeSeriesMetric,
  computeSeriesMetricInputSchema,
  querySubmissionsForAnalysisSchema,
  type AnalyticsAggregationQuery,
  type QuerySubmissionsForAnalysisInput,
} from "@/entities/form-submission";
import type {
  AnalysisRecordsResult,
  AnalyticsAggregationResult,
  AnalyticsResult,
} from "@/entities/form-submission/server";
import {
  ANALYSIS_VIEW_OPERATIONS,
  type NavigatorAnalystAction,
} from "../../types/navigator-action.types";
import { navigateInputSchema } from "./builder-tools";

/**
 * 분석가 도구 카탈로그에서 사용할 서버 저장소 및 집계 엔진 의존성 인터페이스
 */
export interface AnalystToolsDependencies {
  findAnalysisViewById: (id: string) => Promise<AnalysisView | undefined>;
  insertAnalysisView: (input: InsertAnalysisView) => Promise<AnalysisView>;
  updateAnalysisViewById: (
    id: string,
    updates: UpdateAnalysisView
  ) => Promise<AnalysisView | undefined>;
  publishAnalysisViewById: (id: string, isPublished: boolean) => Promise<AnalysisView | undefined>;
  softDeleteAnalysisViewsByIds: (ids: string[]) => Promise<AnalysisView[]>;
  aggregateFormSubmissions: (
    query: AnalyticsAggregationQuery
  ) => Promise<AnalyticsResult<AnalyticsAggregationResult>>;
  queryFormSubmissionsForAnalysis: (
    input: QuerySubmissionsForAnalysisInput
  ) => Promise<AnalyticsResult<AnalysisRecordsResult>>;
}

export const createAnalysisViewInputSchema = z.object({
  title: z
    .string()
    .min(1, "분석 뷰 제목은 필수입니다.")
    .max(255, "분석 뷰 제목은 최대 255자까지 가능합니다.")
    .describe("생성할 분석 뷰 문서의 제목"),
  description: z.string().optional().describe("분석 뷰 문서의 부제목 또는 요약 설명"),
  blocks: z
    .array(analysisBlockSchema)
    .default([])
    .describe("문서를 구성하는 초기 콘텐츠 블록 목록 (text, table, chart)"),
});

export const updateAnalysisViewInputSchema = z.object({
  viewId: z.uuid("수정할 분석 뷰의 고유 ID(UUID)는 필수입니다."),
  operation: z
    .enum(ANALYSIS_VIEW_OPERATIONS)
    .describe(
      "수행할 오퍼레이션: ADD_BLOCK, UPDATE_BLOCK, REMOVE_BLOCK, REORDER_BLOCKS, UPDATE_INFO, SET_ALL_BLOCKS"
    ),
  targetBlockId: z
    .string()
    .optional()
    .describe("UPDATE_BLOCK, REMOVE_BLOCK 시 조작 대상 블록의 id"),
  block: analysisBlockSchema
    .optional()
    .describe("ADD_BLOCK 또는 UPDATE_BLOCK 시 추가/교체할 단일 블록 객체"),
  insertIndex: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("ADD_BLOCK 시 삽입할 0-based 위치 인덱스 (생략 시 맨 뒤에 추가)"),
  blockIds: z
    .array(z.string().min(1))
    .optional()
    .describe("REORDER_BLOCKS 시 기존 블록 ID들의 새로운 전체 순서 배열"),
  blocks: z
    .array(analysisBlockSchema)
    .optional()
    .describe("SET_ALL_BLOCKS 시 문서 전체를 교체할 블록 배열"),
  title: z.string().min(1).max(255).optional().describe("UPDATE_INFO 시 변경할 문서 제목"),
  description: z.string().optional().describe("UPDATE_INFO 시 변경할 문서 설명"),
});

export const publishAnalysisViewInputSchema = z.object({
  viewId: z.uuid("발행 상태를 변경할 분석 뷰 ID(UUID)는 필수입니다."),
  isPublished: z
    .boolean()
    .default(true)
    .describe("true: 컨슈머 포털에 공식 발행, false: 초안으로 회수"),
});

export const deleteAnalysisViewsInputSchema = z.object({
  viewIds: z
    .array(z.uuid("유효한 분석 뷰 UUID가 필요합니다."))
    .min(1, "최소 1개 이상의 분석 뷰 ID가 필요합니다."),
});

/**
 * 블록 ID 중복 여부를 검증합니다.
 */
function hasDuplicateBlockIds(blocks: AnalysisBlock[]): boolean {
  const seen = new Set<string>();
  for (const b of blocks) {
    if (seen.has(b.id)) return true;
    seen.add(b.id);
  }
  return false;
}

/**
 * AI Analyst Navigator Vercel AI SDK 도구 카탈로그 생성 팩토리 함수
 *
 * 폼 조회(searchForms, getFormDetails)는 공통 queryTools가 담당하며,
 * 본 도구 모음은 서버 집계, 결정론적 시리즈 산술 연산, 분석 뷰 문서 CRUD/발행/네비게이션을 담당합니다.
 */
export function createAnalystTools(deps: AnalystToolsDependencies) {
  const navigateTool = tool({
    description:
      "분석가 작업 공간 내의 화면으로 이동합니다. 분석 뷰 목록(/analyst/views) 또는 특정 분석 뷰 캔버스(/analyst/views/[id])로 이동할 때 호출합니다.",
    inputSchema: navigateInputSchema,
    execute: async ({ targetPath, reason }: z.infer<typeof navigateInputSchema>) => {
      const action: NavigatorAnalystAction = {
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

  const aggregateFormSubmissionsTool = tool({
    description:
      "단일 폼의 제출 응답을 PostgreSQL DB 레벨에서 count, sum, avg, min, max 기준으로 정확하게 집계합니다. 시계열(timeBucket: day|week|month|quarter) 및 선택형/관계형 필드 그룹화(groupByFieldId)를 지원합니다.",
    inputSchema: analyticsAggregationQuerySchema,
    execute: async (input: AnalyticsAggregationQuery) => {
      const result = await deps.aggregateFormSubmissions(input);
      if (result.error !== null) {
        return {
          success: false,
          error: result.error,
        };
      }
      return {
        success: true,
        data: result.data,
      };
    },
  });

  const queryFormSubmissionsTool = tool({
    description:
      "정성적 피드백, 상세 사유 등 개별 원천 제출 레코드 샘플이 필요할 때 최신순/과거순으로 최대 50건까지 조회합니다. 선택형/관계형 필드는 사람이 읽을 수 있는 라벨로 변환되어 반환됩니다.",
    inputSchema: querySubmissionsForAnalysisSchema,
    execute: async (input: QuerySubmissionsForAnalysisInput) => {
      const result = await deps.queryFormSubmissionsForAnalysis(input);
      if (result.error !== null) {
        return {
          success: false,
          error: result.error,
        };
      }
      return {
        success: true,
        data: result.data,
      };
    },
  });

  const computeSeriesMetricTool = tool({
    description:
      "두 집계 시리즈(baseSeries, targetSeries)의 키를 합집합 Zero-fill로 정렬한 뒤 차액(subtract: base - target), 합산(add: base + target), 백분율 비율(ratio: (base / target) * 100, 분모 0이면 null)을 부동소수점 오차 없이 계산합니다.",
    inputSchema: computeSeriesMetricInputSchema,
    execute: async (input: z.infer<typeof computeSeriesMetricInputSchema>) => {
      const computed = computeSeriesMetric(input);
      return {
        success: true,
        data: computed,
      };
    },
  });

  const createAnalysisViewTool = tool({
    description:
      "새로운 블록 기반 분석 뷰 문서를 생성하여 데이터베이스에 저장하고 해당 분석 뷰 상세 화면(/analyst/views/[id])으로 이동합니다.",
    inputSchema: createAnalysisViewInputSchema,
    execute: async ({
      title,
      description,
      blocks,
    }: z.infer<typeof createAnalysisViewInputSchema>) => {
      if (hasDuplicateBlockIds(blocks)) {
        return {
          success: false,
          error: "분석 뷰 내 모든 블록의 id는 서로 중복될 수 없습니다.",
        };
      }

      const created = await deps.insertAnalysisView({
        title,
        description: description ?? null,
        blocks,
      });

      const createdBlocks = extractAnalysisBlocks(created);
      const action: NavigatorAnalystAction = {
        type: "CREATE_ANALYSIS_VIEW",
        viewId: created.id,
        title: created.title,
        description: created.description ?? undefined,
        blocks: createdBlocks,
        message: `새로운 분석 뷰 '${created.title}'를 생성했습니다.`,
      };

      return {
        success: true,
        viewId: created.id,
        analysisView: created,
        targetPath: `/analyst/views/${created.id}`,
        clientAction: action,
      };
    },
  });

  const updateAnalysisViewTool = tool({
    description:
      "기존 분석 뷰 문서의 특정 블록을 추가/수정/삭제/재배치하거나 메타데이터(제목/설명) 및 전체 블록을 수정합니다.",
    inputSchema: updateAnalysisViewInputSchema,
    execute: async ({
      viewId,
      operation,
      targetBlockId,
      block,
      insertIndex,
      blockIds,
      blocks: nextAllBlocks,
      title,
      description,
    }: z.infer<typeof updateAnalysisViewInputSchema>) => {
      const existing = await deps.findAnalysisViewById(viewId);
      if (!existing) {
        return {
          success: false,
          error: `수정 대상 분석 뷰('${viewId}')를 찾을 수 없습니다.`,
        };
      }

      const currentBlocks = extractAnalysisBlocks(existing);
      let updatedBlocks: AnalysisBlock[] = [...currentBlocks];
      let nextTitle: string | undefined;
      let nextDescription: string | null | undefined;

      switch (operation) {
        case "ADD_BLOCK": {
          if (!block) {
            return {
              success: false,
              error: "ADD_BLOCK 오퍼레이션에는 추가할 block 객체가 필수입니다.",
            };
          }
          if (currentBlocks.some((b) => b.id === block.id)) {
            return {
              success: false,
              error: `이미 동일한 블록 ID('${block.id}')가 문서에 존재합니다.`,
            };
          }
          if (insertIndex !== undefined) {
            const clampedIndex = Math.max(0, Math.min(insertIndex, updatedBlocks.length));
            updatedBlocks.splice(clampedIndex, 0, block);
          } else {
            updatedBlocks.push(block);
          }
          break;
        }

        case "UPDATE_BLOCK": {
          if (!targetBlockId || !block) {
            return {
              success: false,
              error: "UPDATE_BLOCK 오퍼레이션에는 targetBlockId와 block 객체가 모두 필요합니다.",
            };
          }
          const targetIdx = currentBlocks.findIndex((b) => b.id === targetBlockId);
          if (targetIdx === -1) {
            return {
              success: false,
              error: `수정 대상 블록 ID('${targetBlockId}')를 찾을 수 없습니다.`,
            };
          }
          // 기존 블록 ID를 불변 보존하여 참조 일관성을 유지합니다.
          updatedBlocks[targetIdx] = { ...block, id: targetBlockId };
          break;
        }

        case "REMOVE_BLOCK": {
          if (!targetBlockId) {
            return {
              success: false,
              error: "REMOVE_BLOCK 오퍼레이션에는 targetBlockId가 필수입니다.",
            };
          }
          const exists = currentBlocks.some((b) => b.id === targetBlockId);
          if (!exists) {
            return {
              success: false,
              error: `삭제 대상 블록 ID('${targetBlockId}')를 찾을 수 없습니다.`,
            };
          }
          updatedBlocks = currentBlocks.filter((b) => b.id !== targetBlockId);
          break;
        }

        case "REORDER_BLOCKS": {
          if (!blockIds || blockIds.length === 0) {
            return {
              success: false,
              error: "REORDER_BLOCKS 오퍼레이션에는 blockIds 배열이 필수입니다.",
            };
          }
          const uniqueRequestedIds = new Set(blockIds);
          const blockMap = new Map(currentBlocks.map((b) => [b.id, b]));
          const isExactMatch =
            blockIds.length === currentBlocks.length &&
            uniqueRequestedIds.size === currentBlocks.length &&
            blockIds.every((id) => blockMap.has(id));

          if (!isExactMatch) {
            return {
              success: false,
              error:
                "REORDER_BLOCKS의 blockIds는 기존 블록 ID 집합과 누락·중복 없이 1:1로 정확히 일치해야 합니다.",
            };
          }

          updatedBlocks = blockIds.map((id) => blockMap.get(id)!);
          break;
        }

        case "UPDATE_INFO": {
          if (title === undefined && description === undefined) {
            return {
              success: false,
              error:
                "UPDATE_INFO 오퍼레이션에는 변경할 title 또는 description 중 하나 이상이 필요합니다.",
            };
          }
          if (title !== undefined) nextTitle = title;
          if (description !== undefined) nextDescription = description;
          break;
        }

        case "SET_ALL_BLOCKS": {
          if (!nextAllBlocks) {
            return {
              success: false,
              error: "SET_ALL_BLOCKS 오퍼레이션에는 blocks 배열이 필수입니다.",
            };
          }
          if (hasDuplicateBlockIds(nextAllBlocks)) {
            return {
              success: false,
              error: "SET_ALL_BLOCKS의 블록 id는 서로 중복될 수 없습니다.",
            };
          }
          updatedBlocks = nextAllBlocks;
          if (title !== undefined) nextTitle = title;
          if (description !== undefined) nextDescription = description;
          break;
        }
      }

      const persisted = await deps.updateAnalysisViewById(viewId, {
        ...(nextTitle !== undefined ? { title: nextTitle } : {}),
        ...(nextDescription !== undefined ? { description: nextDescription } : {}),
        blocks: updatedBlocks,
      });

      if (!persisted) {
        return {
          success: false,
          error: "분석 뷰 업데이트 결과를 저장하지 못했습니다.",
        };
      }

      const persistedBlocks = extractAnalysisBlocks(persisted);
      const action: NavigatorAnalystAction = {
        type: "UPDATE_ANALYSIS_VIEW",
        operation,
        viewId: persisted.id,
        title: persisted.title,
        description: persisted.description ?? undefined,
        blocks: persistedBlocks,
        message: `분석 뷰 '${persisted.title}'를 업데이트했습니다.`,
      };

      return {
        success: true,
        analysisView: persisted,
        clientAction: action,
      };
    },
  });

  const publishAnalysisViewTool = tool({
    description:
      "분석 뷰를 공식 발행(isPublished: true)하여 컨슈머 포털(/consumer/views)에 공유하거나 초안(isPublished: false)으로 회수합니다.",
    inputSchema: publishAnalysisViewInputSchema,
    execute: async ({ viewId, isPublished }: z.infer<typeof publishAnalysisViewInputSchema>) => {
      const existing = await deps.findAnalysisViewById(viewId);
      if (!existing) {
        return {
          success: false,
          error: `대상 분석 뷰('${viewId}')를 찾을 수 없습니다.`,
        };
      }

      if (isPublished && extractAnalysisBlocks(existing).length === 0) {
        return {
          success: false,
          error: "분석 뷰를 발행하려면 최소 1개 이상의 콘텐츠 블록이 필요합니다.",
        };
      }

      const updated = await deps.publishAnalysisViewById(viewId, isPublished);
      if (!updated) {
        return {
          success: false,
          error: "발행 상태를 변경하지 못했습니다.",
        };
      }

      const action: NavigatorAnalystAction = {
        type: "PUBLISH_ANALYSIS_VIEW",
        viewId: updated.id,
        isPublished,
        message: isPublished
          ? `분석 뷰 '${updated.title}'를 공식 발행했습니다.`
          : `분석 뷰 '${updated.title}' 발행을 취소하고 초안으로 전환했습니다.`,
      };

      return {
        success: true,
        analysisView: updated,
        clientAction: action,
      };
    },
  });

  const deleteAnalysisViewsTool = tool({
    description: "지정된 하나 이상의 분석 뷰 문서를 소프트 삭제(Soft Delete) 처리합니다.",
    inputSchema: deleteAnalysisViewsInputSchema,
    execute: async ({ viewIds }: z.infer<typeof deleteAnalysisViewsInputSchema>) => {
      const deleted = await deps.softDeleteAnalysisViewsByIds(viewIds);
      if (deleted.length === 0) {
        return {
          success: false,
          error: "삭제할 수 있는 활성 분석 뷰를 찾지 못했습니다.",
        };
      }

      const deletedIds = deleted.map((v) => v.id);
      const action: NavigatorAnalystAction = {
        type: "DELETE_ANALYSIS_VIEWS",
        deletedIds,
        message: `${deletedIds.length}건의 분석 뷰를 삭제했습니다.`,
      };

      return {
        success: true,
        deletedIds,
        clientAction: action,
      };
    },
  });

  return {
    navigate: navigateTool,
    aggregateFormSubmissions: aggregateFormSubmissionsTool,
    queryFormSubmissions: queryFormSubmissionsTool,
    computeSeriesMetric: computeSeriesMetricTool,
    createAnalysisView: createAnalysisViewTool,
    updateAnalysisView: updateAnalysisViewTool,
    publishAnalysisView: publishAnalysisViewTool,
    deleteAnalysisViews: deleteAnalysisViewsTool,
  };
}
