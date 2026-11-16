import { describe, expect, it } from "vitest";
import {
  analysisBlockSchema,
  insertAnalysisViewSchema,
  selectAnalysisViewSchema,
  updateAnalysisViewSchema,
} from "./analysis-view.schema";

describe("AnalysisView Schema Validation Engine", () => {
  describe("analysisBlockSchema (3종 블록 Discriminated Union 검증)", () => {
    it("유효한 글(text), 데이터 테이블(table), 차트(chart) 블록을 모두 통과시켜야 한다", () => {
      const textBlock = {
        id: "blk_text_1",
        type: "text",
        title: "분기별 핵심 요약",
        content: "1분기 대비 2분기 매출이 20% 증가했습니다.",
      };
      const tableBlock = {
        id: "blk_table_1",
        type: "table",
        title: "분기별 손익 비교표",
        columns: [
          { key: "quarter", label: "분기", align: "left" },
          { key: "revenue", label: "매출", align: "right" },
          { key: "profit", label: "순이익", align: "right" },
        ],
        rows: [
          { quarter: "2026-Q1", revenue: 1000, profit: 300 },
          { quarter: "2026-Q2", revenue: 1200, profit: null },
        ],
      };
      const chartBlock = {
        id: "blk_chart_1",
        type: "chart",
        title: "분기별 매출 추이",
        chartType: "bar",
        xAxisKey: "quarter",
        series: [{ key: "revenue", label: "매출" }],
        data: [
          { quarter: "2026-Q1", revenue: 1000 },
          { quarter: "2026-Q2", revenue: 1200 },
        ],
      };

      expect(analysisBlockSchema.safeParse(textBlock).success).toBe(true);
      expect(analysisBlockSchema.safeParse(tableBlock).success).toBe(true);
      expect(analysisBlockSchema.safeParse(chartBlock).success).toBe(true);
    });

    it("text 블록의 content가 비어있거나 table 컬럼이 0개이면 실패해야 한다", () => {
      const emptyText = {
        id: "blk_1",
        type: "text",
        content: "",
      };
      const emptyTableColumns = {
        id: "blk_2",
        type: "table",
        title: "빈 컬럼 표",
        columns: [],
        rows: [],
      };
      const invalidChartType = {
        id: "blk_3",
        type: "chart",
        title: "미지원 차트",
        chartType: "radar",
        xAxisKey: "x",
        series: [{ key: "y", label: "Y" }],
        data: [],
      };

      expect(analysisBlockSchema.safeParse(emptyText).success).toBe(false);
      expect(analysisBlockSchema.safeParse(emptyTableColumns).success).toBe(false);
      expect(analysisBlockSchema.safeParse(invalidChartType).success).toBe(false);
    });
  });

  describe("insertAnalysisViewSchema (신규 분석 뷰 검증 및 시스템 필드 차단)", () => {
    it("제목과 블록 목록이 유효하면 검증을 통과하고 blocks 기본값이 빈 배열이어야 한다", () => {
      const minimal = insertAnalysisViewSchema.safeParse({
        title: "2026년 1~2분기 손익 분석",
      });
      expect(minimal.success).toBe(true);
      if (minimal.success) {
        expect(minimal.data.blocks).toEqual([]);
      }
    });

    it("제목이 비어있거나 255자를 초과하면 실패해야 한다", () => {
      expect(insertAnalysisViewSchema.safeParse({ title: "" }).success).toBe(false);
      expect(insertAnalysisViewSchema.safeParse({ title: "가".repeat(256) }).success).toBe(false);
    });

    it("시스템 관리 필드(id, createdAt, updatedAt, publishedAt, deletedAt)가 주입되어도 파싱 결과에서 제거되어야 한다", () => {
      const payloadWithSystemFields = {
        id: "11111111-1111-4111-8111-111111111111",
        title: "보안 테스트 문서",
        createdAt: new Date("2020-01-01T00:00:00Z"),
        updatedAt: new Date("2020-01-01T00:00:00Z"),
        publishedAt: new Date("2020-01-01T00:00:00Z"),
        deletedAt: new Date("2020-01-01T00:00:00Z"),
        blocks: [],
      };

      const parsed = insertAnalysisViewSchema.safeParse(payloadWithSystemFields);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect("id" in parsed.data).toBe(false);
        expect("createdAt" in parsed.data).toBe(false);
        expect("updatedAt" in parsed.data).toBe(false);
        expect("publishedAt" in parsed.data).toBe(false);
        expect("deletedAt" in parsed.data).toBe(false);
      }
    });
  });

  describe("updateAnalysisViewSchema & selectAnalysisViewSchema", () => {
    it("부분 수정 시 title만 전달하거나 blocks만 전달해도 검증을 통과해야 한다", () => {
      expect(updateAnalysisViewSchema.safeParse({ title: "수정된 제목" }).success).toBe(true);
      expect(
        updateAnalysisViewSchema.safeParse({
          blocks: [{ id: "b1", type: "text", content: "요약 내용" }],
        }).success
      ).toBe(true);
    });

    it("DB 조회 모델 selectAnalysisViewSchema는 타임스탬프와 블록 배열을 검증해야 한다", () => {
      const dbRow = {
        id: "22222222-2222-4222-8222-222222222222",
        title: "조회 문서",
        description: null,
        blocks: [{ id: "b1", type: "text", content: "본문" }],
        createdAt: new Date("2026-11-16T00:00:00Z"),
        updatedAt: new Date("2026-11-16T00:00:00Z"),
        publishedAt: null,
        deletedAt: null,
      };

      expect(selectAnalysisViewSchema.safeParse(dbRow).success).toBe(true);
    });
  });
});
