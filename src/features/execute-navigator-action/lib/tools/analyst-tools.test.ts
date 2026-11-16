import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisBlock, AnalysisView } from "@/entities/analysis-view";
import { createAnalystTools, type AnalystToolsDependencies } from "./analyst-tools";

const VIEW_ID = "550e8400-e29b-41d4-a716-446655440100";
const FORM_ID = "550e8400-e29b-41d4-a716-446655440200";
const SECOND_VIEW_ID = "550e8400-e29b-41d4-a716-446655440101";

const SAMPLE_BLOCK_1: AnalysisBlock = {
  id: "block-1",
  type: "text",
  title: "개요",
  content: "요약 내용입니다.",
};

const SAMPLE_BLOCK_2: AnalysisBlock = {
  id: "block-2",
  type: "table",
  title: "월별 수치",
  columns: [
    { key: "key", label: "월", align: "left" },
    { key: "amount", label: "금액", align: "right" },
  ],
  rows: [{ key: "2026-01", amount: 1000 }],
};

const SAMPLE_BLOCK_3: AnalysisBlock = {
  id: "block-3",
  type: "chart",
  title: "추이 차트",
  chartType: "bar",
  xAxisKey: "key",
  series: [{ key: "amount", label: "금액" }],
  data: [{ key: "2026-01", amount: 1000 }],
};

const createMockAnalysisView = (overrides: Partial<AnalysisView> = {}): AnalysisView => ({
  id: VIEW_ID,
  title: "매출 vs 비용 분석",
  description: "1분기 비교 리포트",
  blocks: [SAMPLE_BLOCK_1, SAMPLE_BLOCK_2],
  publishedAt: null,
  createdAt: new Date("2026-02-01T00:00:00.000Z"),
  updatedAt: new Date("2026-02-01T00:00:00.000Z"),
  deletedAt: null,
  ...overrides,
});

function createMockDeps(): AnalystToolsDependencies {
  return {
    findAnalysisViewById: vi.fn(),
    insertAnalysisView: vi.fn(),
    updateAnalysisViewById: vi.fn(),
    publishAnalysisViewById: vi.fn(),
    softDeleteAnalysisViewsByIds: vi.fn(),
    aggregateFormSubmissions: vi.fn(),
    queryFormSubmissionsForAnalysis: vi.fn(),
  };
}

const TOOL_CTX = { toolCallId: "tc-1", messages: [], context: {} };

describe("Analyst Navigator Tools (analyst-tools.ts)", () => {
  let deps: AnalystToolsDependencies;
  let tools: ReturnType<typeof createAnalystTools>;

  beforeEach(() => {
    deps = createMockDeps();
    tools = createAnalystTools(deps);
  });

  it("navigate는 NAVIGATE clientAction을 반환한다", async () => {
    const res = await tools.navigate.execute(
      { targetPath: "/analyst/views", reason: "목록 이동" },
      TOOL_CTX
    );

    expect(res).toMatchObject({
      success: true,
      targetPath: "/analyst/views",
      clientAction: {
        type: "NAVIGATE",
        targetPath: "/analyst/views",
        message: "목록 이동",
      },
    });
  });

  it("aggregateFormSubmissions는 서버 집계 결과를 반환하고 에러 시 success: false를 반환한다", async () => {
    vi.mocked(deps.aggregateFormSubmissions).mockResolvedValueOnce({
      data: {
        formId: FORM_ID,
        formTitle: "매출 폼",
        metric: "sum",
        timezone: "Asia/Seoul",
        totalCount: 2,
        summaryValue: 300,
        points: [{ key: "2026-01", value: 300, count: 2 }],
      },
      error: null,
    });

    const okRes = await tools.aggregateFormSubmissions.execute(
      {
        formId: FORM_ID,
        metric: "sum",
        targetFieldId: "f_amount",
        timezone: "Asia/Seoul",
        limit: 50,
      },
      TOOL_CTX
    );
    expect(okRes).toMatchObject({ success: true });

    vi.mocked(deps.aggregateFormSubmissions).mockResolvedValueOnce({
      data: null,
      error: "숫자형 필드가 아닙니다.",
    });
    const errRes = await tools.aggregateFormSubmissions.execute(
      { formId: FORM_ID, metric: "count", timezone: "Asia/Seoul", limit: 50 },
      TOOL_CTX
    );
    expect(errRes).toEqual({ success: false, error: "숫자형 필드가 아닙니다." });
  });

  it("computeSeriesMetric은 subtract 및 ratio(분모 0이면 null)를 결정론적으로 계산한다", async () => {
    const res = await tools.computeSeriesMetric.execute(
      {
        operation: "ratio",
        baseSeries: [
          { key: "2026-01", value: 50 },
          { key: "2026-02", value: 10 },
        ],
        targetSeries: [
          { key: "2026-01", value: 200 },
          { key: "2026-02", value: 0 },
        ],
        resultKey: "rate",
      },
      TOOL_CTX
    );

    expect(res).toEqual({
      success: true,
      data: {
        operation: "ratio",
        resultKey: "rate",
        rows: [
          { key: "2026-01", baseValue: 50, targetValue: 200, rate: 25 },
          { key: "2026-02", baseValue: 10, targetValue: 0, rate: null },
        ],
      },
    });
  });

  it("createAnalysisView는 새 문서를 저장하고 CREATE_ANALYSIS_VIEW 액션을 반환한다", async () => {
    const created = createMockAnalysisView();
    vi.mocked(deps.insertAnalysisView).mockResolvedValue(created);

    const res = await tools.createAnalysisView.execute(
      {
        title: "매출 vs 비용 분석",
        description: "1분기 비교 리포트",
        blocks: [SAMPLE_BLOCK_1, SAMPLE_BLOCK_2],
      },
      TOOL_CTX
    );

    expect(deps.insertAnalysisView).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({
      success: true,
      viewId: VIEW_ID,
      targetPath: `/analyst/views/${VIEW_ID}`,
      clientAction: {
        type: "CREATE_ANALYSIS_VIEW",
        viewId: VIEW_ID,
        title: "매출 vs 비용 분석",
      },
    });
  });

  describe("updateAnalysisView (6 Operators)", () => {
    it("ADD_BLOCK: insertIndex 지정 시 해당 위치에 블록을 삽입하고 미지정 시 맨 뒤에 추가한다", async () => {
      vi.mocked(deps.findAnalysisViewById).mockResolvedValue(createMockAnalysisView());
      vi.mocked(deps.updateAnalysisViewById).mockImplementation(async (_id, updates) =>
        createMockAnalysisView({
          blocks: updates.blocks ?? [SAMPLE_BLOCK_1, SAMPLE_BLOCK_2],
        })
      );

      const res = await tools.updateAnalysisView.execute(
        {
          viewId: VIEW_ID,
          operation: "ADD_BLOCK",
          block: SAMPLE_BLOCK_3,
          insertIndex: 1,
        },
        TOOL_CTX
      );

      expect(res).toMatchObject({
        success: true,
        clientAction: {
          type: "UPDATE_ANALYSIS_VIEW",
          operation: "ADD_BLOCK",
        },
      });
      const updatedCall = vi.mocked(deps.updateAnalysisViewById).mock.calls[0]?.[1];
      expect(updatedCall?.blocks?.map((b) => b.id)).toEqual(["block-1", "block-3", "block-2"]);
    });

    it("UPDATE_BLOCK: targetBlockId를 불변 보존하면서 해당 블록 내용만 교체한다", async () => {
      vi.mocked(deps.findAnalysisViewById).mockResolvedValue(createMockAnalysisView());
      vi.mocked(deps.updateAnalysisViewById).mockImplementation(async (_id, updates) =>
        createMockAnalysisView({
          blocks: updates.blocks ?? [SAMPLE_BLOCK_1, SAMPLE_BLOCK_2],
        })
      );

      await tools.updateAnalysisView.execute(
        {
          viewId: VIEW_ID,
          operation: "UPDATE_BLOCK",
          targetBlockId: "block-1",
          block: {
            id: "wrong-new-id",
            type: "text",
            title: "수정된 개요",
            content: "업데이트된 내용",
          },
        },
        TOOL_CTX
      );

      const updatedCall = vi.mocked(deps.updateAnalysisViewById).mock.calls[0]?.[1];
      expect(updatedCall?.blocks?.[0]).toEqual({
        id: "block-1",
        type: "text",
        title: "수정된 개요",
        content: "업데이트된 내용",
      });
    });

    it("REMOVE_BLOCK: 대상 블록 ID를 제거한다", async () => {
      vi.mocked(deps.findAnalysisViewById).mockResolvedValue(createMockAnalysisView());
      vi.mocked(deps.updateAnalysisViewById).mockImplementation(async (_id, updates) =>
        createMockAnalysisView({
          blocks: updates.blocks ?? [SAMPLE_BLOCK_1, SAMPLE_BLOCK_2],
        })
      );

      await tools.updateAnalysisView.execute(
        {
          viewId: VIEW_ID,
          operation: "REMOVE_BLOCK",
          targetBlockId: "block-2",
        },
        TOOL_CTX
      );

      const updatedCall = vi.mocked(deps.updateAnalysisViewById).mock.calls[0]?.[1];
      expect(updatedCall?.blocks?.map((b) => b.id)).toEqual(["block-1"]);
    });

    it("REORDER_BLOCKS: 기존 ID 집합과 1:1 일치 시 순서를 재배치하고 불일치 시 거부한다", async () => {
      vi.mocked(deps.findAnalysisViewById).mockResolvedValue(createMockAnalysisView());
      vi.mocked(deps.updateAnalysisViewById).mockImplementation(async (_id, updates) =>
        createMockAnalysisView({
          blocks: updates.blocks ?? [SAMPLE_BLOCK_1, SAMPLE_BLOCK_2],
        })
      );

      const mismatchRes = await tools.updateAnalysisView.execute(
        {
          viewId: VIEW_ID,
          operation: "REORDER_BLOCKS",
          blockIds: ["block-1"],
        },
        TOOL_CTX
      );
      expect(mismatchRes).toMatchObject({ success: false });

      const okRes = await tools.updateAnalysisView.execute(
        {
          viewId: VIEW_ID,
          operation: "REORDER_BLOCKS",
          blockIds: ["block-2", "block-1"],
        },
        TOOL_CTX
      );
      expect(okRes).toMatchObject({ success: true });
      const updatedCall = vi.mocked(deps.updateAnalysisViewById).mock.calls[0]?.[1];
      expect(updatedCall?.blocks?.map((b) => b.id)).toEqual(["block-2", "block-1"]);
    });

    it("UPDATE_INFO: 블록은 보존하고 제목/설명을 변경한다", async () => {
      vi.mocked(deps.findAnalysisViewById).mockResolvedValue(createMockAnalysisView());
      vi.mocked(deps.updateAnalysisViewById).mockImplementation(async (_id, updates) =>
        createMockAnalysisView({
          title: updates.title ?? "매출 vs 비용 분석",
          description: updates.description ?? null,
        })
      );

      const res = await tools.updateAnalysisView.execute(
        {
          viewId: VIEW_ID,
          operation: "UPDATE_INFO",
          title: "변경된 리포트 제목",
          description: "변경된 설명",
        },
        TOOL_CTX
      );

      expect(res).toMatchObject({
        success: true,
        clientAction: {
          type: "UPDATE_ANALYSIS_VIEW",
          operation: "UPDATE_INFO",
          title: "변경된 리포트 제목",
        },
      });
    });

    it("SET_ALL_BLOCKS: 전체 블록을 일괄 교체한다", async () => {
      vi.mocked(deps.findAnalysisViewById).mockResolvedValue(createMockAnalysisView());
      vi.mocked(deps.updateAnalysisViewById).mockImplementation(async (_id, updates) =>
        createMockAnalysisView({
          blocks: updates.blocks ?? [SAMPLE_BLOCK_1, SAMPLE_BLOCK_2],
        })
      );

      const res = await tools.updateAnalysisView.execute(
        {
          viewId: VIEW_ID,
          operation: "SET_ALL_BLOCKS",
          blocks: [SAMPLE_BLOCK_3],
        },
        TOOL_CTX
      );

      expect(res).toMatchObject({ success: true });
      const updatedCall = vi.mocked(deps.updateAnalysisViewById).mock.calls[0]?.[1];
      expect(updatedCall?.blocks).toEqual([SAMPLE_BLOCK_3]);
    });
  });

  it("publishAnalysisView는 블록이 0개인 문서 발행을 거부하고, 블록이 있으면 발행 상태를 전환한다", async () => {
    vi.mocked(deps.findAnalysisViewById).mockResolvedValueOnce(
      createMockAnalysisView({ blocks: [] })
    );
    const emptyErr = await tools.publishAnalysisView.execute(
      { viewId: VIEW_ID, isPublished: true },
      TOOL_CTX
    );
    expect(emptyErr).toMatchObject({ success: false });

    vi.mocked(deps.findAnalysisViewById).mockResolvedValueOnce(createMockAnalysisView());
    vi.mocked(deps.publishAnalysisViewById).mockResolvedValueOnce(
      createMockAnalysisView({ publishedAt: new Date("2026-02-02T00:00:00.000Z") })
    );

    const okRes = await tools.publishAnalysisView.execute(
      { viewId: VIEW_ID, isPublished: true },
      TOOL_CTX
    );
    expect(okRes).toMatchObject({
      success: true,
      clientAction: {
        type: "PUBLISH_ANALYSIS_VIEW",
        viewId: VIEW_ID,
        isPublished: true,
      },
    });
  });

  it("deleteAnalysisViews는 복수 뷰를 소프트 삭제하고 DELETE_ANALYSIS_VIEWS 액션을 반환한다", async () => {
    vi.mocked(deps.softDeleteAnalysisViewsByIds).mockResolvedValue([
      createMockAnalysisView({ id: VIEW_ID }),
      createMockAnalysisView({ id: SECOND_VIEW_ID }),
    ]);

    const res = await tools.deleteAnalysisViews.execute(
      { viewIds: [VIEW_ID, SECOND_VIEW_ID] },
      TOOL_CTX
    );

    expect(res).toMatchObject({
      success: true,
      deletedIds: [VIEW_ID, SECOND_VIEW_ID],
      clientAction: {
        type: "DELETE_ANALYSIS_VIEWS",
        deletedIds: [VIEW_ID, SECOND_VIEW_ID],
      },
    });
  });
});
