import { tool } from "ai";
import {
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
  type ComputeSeriesMetricInput,
  type QuerySubmissionsForAnalysisInput,
} from "@/entities/form-submission";
import type {
  AnalysisRecordsResult,
  AnalyticsAggregationResult,
  AnalyticsResult,
} from "@/entities/form-submission/server";
import {
  createAnalysisViewInputSchema,
  deleteAnalysisViewsInputSchema,
  navigateInputSchema,
  publishAnalysisViewInputSchema,
  updateAnalysisViewInputSchema,
  type CreateAnalysisViewInput,
  type DeleteAnalysisViewsInput,
  type NavigateInput,
  type PublishAnalysisViewInput,
  type UpdateAnalysisViewInput,
} from "../../schema/navigator-tools.schema";
import type { OptimisticUpdateResult } from "@/shared/lib/http";
import type { NavigatorAnalystAction } from "../../types/navigator-action.types";
import { buildPendingConfirmationResult } from "./confirmation-gate";

export {
  createAnalysisViewInputSchema,
  deleteAnalysisViewsInputSchema,
  publishAnalysisViewInputSchema,
  updateAnalysisViewInputSchema,
};

/**
 * 분석가 도구 카탈로그에서 사용할 서버 저장소 및 집계 엔진 의존성 인터페이스
 */
export interface AnalystToolsDependencies {
  findAnalysisViewById: (id: string) => Promise<AnalysisView | undefined>;
  insertAnalysisView: (input: InsertAnalysisView) => Promise<AnalysisView>;
  updateAnalysisViewById: (
    id: string,
    updates: UpdateAnalysisView
  ) => Promise<OptimisticUpdateResult<AnalysisView>>;
  publishAnalysisViewById: (id: string, isPublished: boolean) => Promise<AnalysisView | undefined>;
  softDeleteAnalysisViewsByIds: (ids: string[]) => Promise<AnalysisView[]>;
  /** 클라이언트 화면이 현재 보고 있는 분석 뷰 ID (낙관적 락 컨텍스트 대조용) */
  expectedViewId?: string | undefined;
  /** 클라이언트 화면이 현재 보고 있는 분석 뷰 버전 (낙관적 락 컨텍스트 대조용) */
  expectedViewVersion?: number | undefined;
  aggregateFormSubmissions: (
    query: AnalyticsAggregationQuery
  ) => Promise<AnalyticsResult<AnalyticsAggregationResult>>;
  queryFormSubmissionsForAnalysis: (
    input: QuerySubmissionsForAnalysisInput
  ) => Promise<AnalyticsResult<AnalysisRecordsResult>>;
  /** 고위험 도구(publishAnalysisView, deleteAnalysisViews) 실행 전 사용자 확인 게이트 활성화 여부 */
  requireConfirmation?: boolean | undefined;
}

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
 * 테이블/차트 블록에서 정렬 가능한 컬럼 및 데이터 키 집합을 추출합니다.
 */
function getBlockSortableKeys(block: AnalysisBlock): Set<string> {
  if (block.type === "table") {
    const keys = new Set(block.columns.map((col) => col.key));
    for (const row of block.rows) {
      for (const k of Object.keys(row)) keys.add(k);
    }
    return keys;
  }
  if (block.type === "chart") {
    const keys = new Set<string>([block.xAxisKey, ...block.series.map((s) => s.key)]);
    for (const item of block.data) {
      for (const k of Object.keys(item)) keys.add(k);
    }
    return keys;
  }
  return new Set();
}

/**
 * 테이블 행 또는 차트 데이터 배열을 특정 키와 방향 기준으로 결정론적 정렬합니다.
 * null/undefined/NaN은 정렬 방향과 무관하게 항상 하단에 배치합니다.
 */
function sortAnalysisRecords<
  T extends Record<string, string | number | boolean | null | undefined>,
>(records: T[], sortKey: string, sortOrder: "asc" | "desc"): T[] {
  const dir = sortOrder === "desc" ? -1 : 1;
  return [...records].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    const aEmpty = va === null || va === undefined;
    const bEmpty = vb === null || vb === undefined;
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;

    if (typeof va === "number" && typeof vb === "number") {
      return (va - vb) * dir;
    }
    return String(va).localeCompare(String(vb), "ko-KR", { numeric: true }) * dir;
  });
}

/**
 * AI Analyst Navigator Vercel AI SDK 도구 카탈로그 생성 팩토리 함수
 *
 * 폼 조회(searchForms, getFormDetails)는 공통 queryTools가 담당하며,
 * 본 도구 모음은 서버 집계, 결정론적 시리즈 산술 연산, 분석 뷰 문서 CRUD/발행/네비게이션을 담당합니다.
 */
export function createAnalystTools(deps: AnalystToolsDependencies) {
  let trackedClientViewVersion = deps.expectedViewVersion;
  /**
   * 동일 요청 스텝에서 AI가 여러 updateAnalysisView / publishAnalysisView 도구를
   * 동시에 병렬 호출할 때 Read-Modify-Write 경합(Lost Update)을 방지하기 위한 뷰 단위 순차 직렬화 큐
   */
  const viewOperationLocks = new Map<string, Promise<unknown>>();

  function withViewLock<T>(viewId: string, task: () => Promise<T>): Promise<T> {
    const previous = viewOperationLocks.get(viewId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(task);
    viewOperationLocks.set(viewId, next);
    return next;
  }

  const navigateTool = tool({
    description:
      "분석가 작업 공간 내의 화면(/analyst/views, /analyst/views/[id]) 또는 원천 데이터 전체 목록 확인이 필요한 컨슈머 폼 데이터 뷰(/consumer/forms/[id])로 이동합니다.",
    inputSchema: navigateInputSchema,
    execute: async ({ targetPath, reason }: NavigateInput) => {
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
      "단일 폼의 제출 응답을 PostgreSQL DB 레벨에서 count, sum, avg, min, max 기준으로 정확하게 집계합니다. 시계열(timeBucket: day|week|month|quarter), 선택형/관계형 필드 그룹화(groupByFieldId), 타입별 조건 필터링(filters: [{ fieldId, op, value?, values?, min?, max? }] — eq/neq/contains/gt/gte/lt/lte/between/in/notIn/hasAny/hasAll/isEmpty/isNotEmpty 지원), 날짜 기준 축(dateFieldId: 대상 폼에 date 타입 필드가 있을 때 우선 지정, 없으면 생략하여 createdAt 폴백), 기간 범위(startDate/endDate YYYY-MM-DD)를 지원합니다. LIMIT 초과 시 전체 건수(totalCount)/요약값(summaryValue)과 isTruncated 여부를 함께 반환합니다.",
    inputSchema: analyticsAggregationQuerySchema,
    execute: async (input: AnalyticsAggregationQuery) => {
      try {
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
      } catch (err) {
        console.error("aggregateFormSubmissions 실행 오류:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "폼 통계 집계 중 오류가 발생했습니다.",
        };
      }
    },
  });

  const queryFormSubmissionsTool = tool({
    description:
      "정성적 피드백, 상세 사유 등 요약 리포트의 근거로 삼을 소수 원천 레코드 샘플(최대 50건)만 제한적으로 조회합니다. 전체 원천 목록이나 대량 상세 내역 조회에는 사용하지 마세요(해당 목적은 /consumer/forms/[formId] 데이터 뷰로 안내).",
    inputSchema: querySubmissionsForAnalysisSchema,
    execute: async (input: QuerySubmissionsForAnalysisInput) => {
      try {
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
      } catch (err) {
        console.error("queryFormSubmissions 실행 오류:", err);
        return {
          success: false,
          error:
            err instanceof Error ? err.message : "원천 데이터 샘플 조회 중 오류가 발생했습니다.",
        };
      }
    },
  });

  const computeSeriesMetricTool = tool({
    description:
      "두 집계 시리즈(baseSeries, targetSeries)와 선택적 기준 키 목록(includeKeys)의 합집합 Zero-fill로 정렬한 뒤 차액(subtract: base - target), 합산(add: base + target), 백분율 비율(ratio: (base / target) * 100, 분모 0이면 null)을 부동소수점 오차 없이 계산합니다. sortBy('key' | 'baseValue' | 'targetValue' | 'result')와 sortOrder('asc' | 'desc')를 지정하면 결과도 결정론적으로 정렬됩니다.",
    inputSchema: computeSeriesMetricInputSchema,
    execute: async (input: ComputeSeriesMetricInput) => {
      const computed = computeSeriesMetric(input);
      return {
        success: true,
        data: computed,
      };
    },
  });

  const createAnalysisViewTool = tool({
    description:
      "새로운 블록 기반 분석 뷰 문서를 생성하여 데이터베이스에 저장하고 해당 분석 뷰 상세 화면(/analyst/views/[id])으로 이동합니다. 각 블록에는 [원본 데이터 보기] 새 탭 링크가 노출되도록 sourceLinks를 함께 기록하세요.",
    inputSchema: createAnalysisViewInputSchema,
    execute: async ({ title, description, blocks }: CreateAnalysisViewInput) => {
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
      "기존 분석 뷰 문서의 특정 블록을 추가/수정/삭제/재배치/데이터 정렬(SORT_BLOCK_DATA)하거나 메타데이터(제목/설명) 및 전체 블록을 수정합니다. 여러 블록의 기간·기준을 한꺼번에 전환할 때는 SET_ALL_BLOCKS로 title/description/blocks를 원자적으로 일괄 갱신하고, 기존 차트·표의 행 순서만 바꾸려면 SORT_BLOCK_DATA를 사용하세요.",
    inputSchema: updateAnalysisViewInputSchema,
    execute: async ({
      viewId,
      operation,
      targetBlockId,
      block,
      insertIndex,
      blockIds,
      sortKey,
      sortOrder,
      blocks: nextAllBlocks,
      title,
      description,
    }: UpdateAnalysisViewInput) =>
      withViewLock(viewId, async () => {
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
        let shouldPersistBlocks = true;

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
            updatedBlocks[targetIdx] = {
              ...block,
              id: targetBlockId,
            };
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

          case "SORT_BLOCK_DATA": {
            if (!targetBlockId || !sortKey) {
              return {
                success: false,
                error: "SORT_BLOCK_DATA 오퍼레이션에는 targetBlockId와 sortKey가 필수입니다.",
              };
            }
            const targetIdx = currentBlocks.findIndex((b) => b.id === targetBlockId);
            if (targetIdx === -1) {
              return {
                success: false,
                error: `정렬 대상 블록 ID('${targetBlockId}')를 찾을 수 없습니다.`,
              };
            }
            const targetBlock = currentBlocks[targetIdx]!;
            if (targetBlock.type !== "table" && targetBlock.type !== "chart") {
              return {
                success: false,
                error:
                  "SORT_BLOCK_DATA 오퍼레이션은 'table' 또는 'chart' 블록에만 적용할 수 있습니다.",
              };
            }
            const validKeys = getBlockSortableKeys(targetBlock);
            if (!validKeys.has(sortKey)) {
              return {
                success: false,
                error: `블록('${targetBlockId}')에 정렬 키('${sortKey}')가 존재하지 않습니다.`,
              };
            }
            const resolvedOrder = sortOrder ?? "desc";
            updatedBlocks[targetIdx] =
              targetBlock.type === "table"
                ? {
                    ...targetBlock,
                    rows: sortAnalysisRecords(targetBlock.rows, sortKey, resolvedOrder),
                  }
                : {
                    ...targetBlock,
                    data: sortAnalysisRecords(targetBlock.data, sortKey, resolvedOrder),
                  };
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
            shouldPersistBlocks = false;
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

        if (
          deps.expectedViewId === viewId &&
          trackedClientViewVersion !== undefined &&
          existing.version !== trackedClientViewVersion
        ) {
          return {
            success: false,
            error:
              "다른 사용자가 먼저 분석 뷰를 수정했습니다. 화면을 새로고침해 최신 버전을 확인한 뒤 다시 요청해 주세요.",
          };
        }

        const updateResult = await deps.updateAnalysisViewById(viewId, {
          ...(nextTitle !== undefined ? { title: nextTitle } : {}),
          ...(nextDescription !== undefined ? { description: nextDescription } : {}),
          ...(shouldPersistBlocks ? { blocks: updatedBlocks } : {}),
          expectedVersion: existing.version,
        });

        if (updateResult.status === "not_found") {
          return {
            success: false,
            error: "수정 대상 분석 뷰를 찾을 수 없습니다.",
          };
        }
        if (updateResult.status === "conflict") {
          return {
            success: false,
            error:
              "다른 사용자가 동시에 분석 뷰를 수정했습니다. 화면을 새로고침해 최신 버전을 확인한 뒤 다시 시도해 주세요.",
          };
        }

        const persisted = updateResult.data;
        if (deps.expectedViewId === viewId) {
          trackedClientViewVersion = persisted.version;
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
      }),
  });

  const publishAnalysisViewTool = tool({
    description:
      "분석 뷰를 공식 발행(isPublished: true)하여 컨슈머 포털(/consumer)에 공유하거나 초안(isPublished: false)으로 회수합니다.",
    inputSchema: publishAnalysisViewInputSchema,
    execute: async ({ viewId, isPublished }: PublishAnalysisViewInput) =>
      withViewLock(viewId, async () => {
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

        if (deps.requireConfirmation) {
          return buildPendingConfirmationResult({
            toolName: "publishAnalysisView",
            title: isPublished
              ? `'${existing.title}' 분석 뷰 발행`
              : `'${existing.title}' 분석 뷰 발행 취소`,
            description: isPublished
              ? "공식 발행 시 컨슈머 포털에 분석 뷰가 공유됩니다."
              : "초안으로 회수하면 컨슈머 포털 노출이 중단됩니다.",
            targetIds: [existing.id],
            payload: { viewId: existing.id, isPublished },
          });
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
      }),
  });

  const deleteAnalysisViewsTool = tool({
    description: "지정된 하나 이상의 분석 뷰 문서를 소프트 삭제(Soft Delete) 처리합니다.",
    inputSchema: deleteAnalysisViewsInputSchema,
    execute: async ({ viewIds }: DeleteAnalysisViewsInput) => {
      if (deps.requireConfirmation) {
        return buildPendingConfirmationResult({
          toolName: "deleteAnalysisViews",
          title: `분석 뷰 ${viewIds.length}건 삭제`,
          description: "선택한 분석 뷰 문서를 삭제 처리합니다.",
          targetIds: viewIds,
          payload: { viewIds },
        });
      }

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
