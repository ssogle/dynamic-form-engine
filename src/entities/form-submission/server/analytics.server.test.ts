import { beforeEach, describe, expect, it, vi } from "vitest";
import { aggregateFormSubmissions, queryFormSubmissionsForAnalysis } from "./analytics.server";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();
const mockGroupBy = vi.fn();

vi.mock("@/shared/db/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db/server")>();
  return {
    ...actual,
    db: {
      select: (...args: unknown[]) => mockSelect(...args),
    },
  };
});

describe("Analytics Server Engine (entities/form-submission/server/analytics)", () => {
  const formId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const sampleForm = {
    id: formId,
    title: "프로젝트 비용 신청서",
    description: "비용 내역",
    schemaDefinition: {
      primaryFieldId: "f_title",
      fields: [
        { id: "f_title", type: "text", label: "항목명", required: true },
        { id: "f_amount", type: "number", label: "금액", required: true },
        {
          id: "f_dept",
          type: "select",
          label: "부서",
          options: [
            { label: "영업팀", value: "sales", disabled: false },
            { label: "개발팀", value: "dev", disabled: false },
          ],
        },
      ],
    },
    createdAt: new Date("2026-11-01T00:00:00Z"),
    updatedAt: new Date("2026-11-01T00:00:00Z"),
    publishedAt: new Date("2026-11-01T00:00:00Z"),
    deletedAt: null,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({
      limit: mockLimit,
      orderBy: mockOrderBy,
      groupBy: mockGroupBy,
    });
    mockGroupBy.mockReturnValue({
      orderBy: mockOrderBy,
      limit: mockLimit,
    });
    mockOrderBy.mockReturnValue({
      limit: mockLimit,
    });
  });

  describe("aggregateFormSubmissions", () => {
    it("존재하지 않는 폼 ID 요청 시 Result error를 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const result = await aggregateFormSubmissions({
        formId,
        metric: "count",
        timezone: "Asia/Seoul",
        limit: 50,
      });

      expect(result.data).toBeNull();
      expect(result.error).toContain("찾을 수 없습니다");
    });

    it("숫자형이 아닌 필드에 sum/avg 요청 시 Result error를 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([sampleForm]);

      const result = await aggregateFormSubmissions({
        formId,
        metric: "sum",
        targetFieldId: "f_title",
        timezone: "Asia/Seoul",
        limit: 50,
      });

      expect(result.data).toBeNull();
      expect(result.error).toContain("숫자형");
    });

    it("유효하지 않은 timezone 문자열 요청 시 Result error를 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([sampleForm]);

      const result = await aggregateFormSubmissions({
        formId,
        metric: "count",
        timezone: "Invalid/Timezone_Name",
        limit: 50,
      });

      expect(result.data).toBeNull();
      expect(result.error).toContain("시간대");
    });

    it("groupBy + sum 집계 시 select 옵션의 value를 label로 치환하고 부동소수점을 보정해 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([sampleForm]);
      mockLimit.mockResolvedValueOnce([
        { groupKey: '"sales"', metricValue: 15000.0000000001, totalCount: 3 },
        { groupKey: '"dev"', metricValue: 8000, totalCount: 2 },
        { groupKey: null, metricValue: 500, totalCount: 1 },
      ]);

      const result = await aggregateFormSubmissions({
        formId,
        metric: "sum",
        targetFieldId: "f_amount",
        groupByFieldId: "f_dept",
        timezone: "Asia/Seoul",
        limit: 50,
      });

      expect(result.error).toBeNull();
      expect(result.data?.formTitle).toBe("프로젝트 비용 신청서");
      expect(result.data?.points).toEqual([
        { key: "영업팀", groupKey: "영업팀", value: 15000, count: 3 },
        { key: "개발팀", groupKey: "개발팀", value: 8000, count: 2 },
        { key: "미응답", groupKey: "미응답", value: 500, count: 1 },
      ]);
    });

    it("timeBucket(quarter) 단일 집계 시 정규화된 분기 키와 수치를 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([sampleForm]);
      mockLimit.mockResolvedValueOnce([
        { timeKey: "2026-Q1", metricValue: 1000, totalCount: 2 },
        { timeKey: "2026-Q2", metricValue: 2500, totalCount: 4 },
      ]);

      const result = await aggregateFormSubmissions({
        formId,
        metric: "sum",
        targetFieldId: "f_amount",
        timeBucket: "quarter",
        timezone: "Asia/Seoul",
        limit: 50,
      });

      expect(result.error).toBeNull();
      expect(result.data?.points).toEqual([
        { key: "2026-Q1", timeKey: "2026-Q1", value: 1000, count: 2 },
        { key: "2026-Q2", timeKey: "2026-Q2", value: 2500, count: 4 },
      ]);
    });

    it("응답 데이터가 0건인 전체 집계에서도 예외 없이 0을 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([sampleForm]);
      mockWhere
        .mockReturnValueOnce({ limit: mockLimit, orderBy: mockOrderBy, groupBy: mockGroupBy })
        .mockResolvedValueOnce([{ metricValue: null, totalCount: 0 }]);

      const result = await aggregateFormSubmissions({
        formId,
        metric: "count",
        timezone: "Asia/Seoul",
        limit: 50,
      });

      expect(result.error).toBeNull();
      expect(result.data?.summaryValue).toBe(0);
      expect(result.data?.totalCount).toBe(0);
      expect(result.data?.points).toEqual([{ key: "전체", value: 0, count: 0 }]);
    });
  });

  describe("queryFormSubmissionsForAnalysis", () => {
    it("조회된 응답 레코드의 select 코드값을 라벨로 변환해 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([sampleForm]);
      mockLimit.mockResolvedValueOnce([
        {
          id: "sub-1",
          formId,
          data: { f_title: "서버 증설", f_amount: 120000, f_dept: "dev" },
          createdAt: new Date("2026-11-16T00:00:00Z"),
          updatedAt: new Date("2026-11-16T00:00:00Z"),
          deletedAt: null,
        },
      ]);

      const result = await queryFormSubmissionsForAnalysis({
        formId,
        sortOrder: "desc",
        limit: 10,
      });

      expect(result.error).toBeNull();
      expect(result.data?.records).toHaveLength(1);
      expect(result.data?.records[0]?.values).toEqual({
        항목명: "서버 증설",
        금액: 120000,
        부서: "개발팀",
      });
    });
  });
});
