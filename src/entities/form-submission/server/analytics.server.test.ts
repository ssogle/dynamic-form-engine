import { beforeEach, describe, expect, it, vi } from "vitest";
import { aggregateFormSubmissions, queryFormSubmissionsForAnalysis } from "./analytics.server";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();
const mockGroupBy = vi.fn();
const mockAs = vi.fn();

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
        { id: "f_expense_date", type: "date", label: "지출일", required: false },
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
    mockFrom.mockReturnValue({
      where: mockWhere,
      groupBy: mockGroupBy,
    });
    mockWhere.mockReturnValue({
      limit: mockLimit,
      orderBy: mockOrderBy,
      groupBy: mockGroupBy,
      as: mockAs,
    });
    mockAs.mockReturnValue({
      timeKey: "time_key",
      groupKey: "group_key",
      metricValueArg: "metric_value_arg",
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
      mockLimit.mockResolvedValueOnce([{ metricValue: 23500.0000000001, totalCount: 6 }]);
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
      expect(result.data?.dateAxis).toBe("createdAt");
      expect(result.data?.totalCount).toBe(6);
      expect(result.data?.summaryValue).toBe(23500);
      expect(result.data?.isTruncated).toBe(false);
      expect(result.data?.points).toEqual([
        { key: "영업팀", groupKey: "영업팀", value: 15000, count: 3 },
        { key: "개발팀", groupKey: "개발팀", value: 8000, count: 2 },
        { key: "미응답", groupKey: "미응답", value: 500, count: 1 },
      ]);
    });

    it("timeBucket(quarter) 단일 집계 시 정규화된 분기 키와 수치를 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([sampleForm]);
      mockLimit.mockResolvedValueOnce([{ metricValue: 3500, totalCount: 6 }]);
      mockLimit.mockResolvedValueOnce([
        { timeKey: "2026-Q2", metricValue: 2500, totalCount: 4 },
        { timeKey: "2026-Q1", metricValue: 1000, totalCount: 2 },
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

    it("대용량 버킷 LIMIT 절단 시에도 totalCount/summaryValue는 전체 집계 기준으로 유지되고 최신 구간 우선 정렬 후 ASC 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([sampleForm]);
      // 전체 필터 집합 10만 건 기준 요약 (limit 2로 버킷이 잘리더라도 왜곡되지 않아야 함)
      mockLimit.mockResolvedValueOnce([{ metricValue: 50000000, totalCount: 100000 }]);
      // DESC로 limit+1(3)건 반환 -> 최신 2건("2026-11", "2026-10") 유지 및 isTruncated: true
      mockLimit.mockResolvedValueOnce([
        { timeKey: "2026-11", metricValue: 30000, totalCount: 60 },
        { timeKey: "2026-10", metricValue: 20000, totalCount: 40 },
        { timeKey: "2026-09", metricValue: 10000, totalCount: 20 },
      ]);

      const result = await aggregateFormSubmissions({
        formId,
        metric: "sum",
        targetFieldId: "f_amount",
        timeBucket: "month",
        dateFieldId: "f_expense_date",
        startDate: "2026-01-01",
        endDate: "2026-11-30",
        timezone: "Asia/Seoul",
        limit: 2,
      });

      expect(result.error).toBeNull();
      expect(result.data?.dateAxis).toBe("field");
      expect(result.data?.dateFieldId).toBe("f_expense_date");
      expect(result.data?.dateFieldLabel).toBe("지출일");
      expect(result.data?.totalCount).toBe(100000);
      expect(result.data?.summaryValue).toBe(50000000);
      expect(result.data?.isTruncated).toBe(true);
      expect(result.data?.points).toEqual([
        { key: "2026-10", timeKey: "2026-10", value: 20000, count: 40 },
        { key: "2026-11", timeKey: "2026-11", value: 30000, count: 60 },
      ]);
    });

    it("date 타입이 아니거나 존재하지 않는 dateFieldId 전달 시 Result error를 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([sampleForm]);
      const nonDateField = await aggregateFormSubmissions({
        formId,
        metric: "count",
        dateFieldId: "f_title",
        timezone: "Asia/Seoul",
        limit: 50,
      });
      expect(nonDateField.data).toBeNull();
      expect(nonDateField.error).toContain("날짜형");

      mockLimit.mockResolvedValueOnce([sampleForm]);
      const missingField = await aggregateFormSubmissions({
        formId,
        metric: "count",
        dateFieldId: "f_unknown",
        timezone: "Asia/Seoul",
        limit: 50,
      });
      expect(missingField.data).toBeNull();
      expect(missingField.error).toContain("존재하지 않습니다");
    });

    it("응답 데이터가 0건인 전체 집계에서도 예외 없이 0을 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([sampleForm]);
      mockLimit.mockResolvedValueOnce([{ metricValue: null, totalCount: 0 }]);

      const result = await aggregateFormSubmissions({
        formId,
        metric: "count",
        timezone: "Asia/Seoul",
        limit: 50,
      });

      expect(result.error).toBeNull();
      expect(result.data?.summaryValue).toBe(0);
      expect(result.data?.totalCount).toBe(0);
      expect(result.data?.isTruncated).toBe(false);
      expect(result.data?.points).toEqual([{ key: "전체", value: 0, count: 0 }]);
    });

    it("relation 필드 groupBy 시 서브쿼리 기반 집계 후 참조 폼의 대표 필드(primaryFieldId) 표시명으로 치환한다", async () => {
      const targetFormId = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
      const subIdA = "11111111-1111-4111-8111-111111111111";
      const subIdB = "22222222-2222-4222-8222-222222222222";

      const formWithRelation = {
        ...sampleForm,
        schemaDefinition: {
          ...sampleForm.schemaDefinition,
          fields: [
            ...sampleForm.schemaDefinition.fields,
            {
              id: "f_project",
              type: "relation",
              label: "프로젝트",
              relationConfig: { multiple: false, targetFormId },
            },
          ],
        },
      };

      const projectForm = {
        id: targetFormId,
        title: "프로젝트 관리",
        schemaDefinition: {
          primaryFieldId: "project_name",
          fields: [{ id: "project_name", type: "text", label: "프로젝트명" }],
        },
      };

      mockLimit
        .mockResolvedValueOnce([formWithRelation])
        .mockResolvedValueOnce([{ metricValue: 5000, totalCount: 2 }])
        .mockResolvedValueOnce([
          { groupKey: JSON.stringify(subIdB), metricValue: 3000, totalCount: 1 },
          { groupKey: JSON.stringify(subIdA), metricValue: 2000, totalCount: 1 },
        ])
        .mockResolvedValueOnce([projectForm])
        .mockResolvedValueOnce([
          { id: subIdA, data: { project_name: "프로젝트 A" } },
          { id: subIdB, data: { project_name: "프로젝트 B" } },
        ]);

      const result = await aggregateFormSubmissions({
        formId,
        metric: "sum",
        targetFieldId: "f_amount",
        groupByFieldId: "f_project",
        dateFieldId: "f_expense_date",
        startDate: "2026-11-01",
        endDate: "2026-11-30",
        timezone: "Asia/Seoul",
        limit: 50,
      });

      expect(result.error).toBeNull();
      expect(mockAs).toHaveBeenCalledWith("agg_source");
      expect(result.data?.totalCount).toBe(2);
      expect(result.data?.summaryValue).toBe(5000);
      expect(result.data?.points).toEqual([
        { key: "프로젝트 B", groupKey: "프로젝트 B", value: 3000, count: 1 },
        { key: "프로젝트 A", groupKey: "프로젝트 A", value: 2000, count: 1 },
      ]);
    });

    it("존재하지 않는 필드 ID로 filters 전달 시 Result error를 반환하고, 관계형 표시명 필터 시 대상 레코드 UUID를 조회해 필터링한다", async () => {
      mockLimit.mockResolvedValueOnce([sampleForm]);
      const invalidFilterRes = await aggregateFormSubmissions({
        formId,
        metric: "count",
        timezone: "Asia/Seoul",
        filters: [{ fieldId: "unknown_field", value: "abc" }],
        limit: 50,
      });
      expect(invalidFilterRes.data).toBeNull();
      expect(invalidFilterRes.error).toContain("필터 기준 필드");

      const targetFormId = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
      const subIdA = "11111111-1111-4111-8111-111111111111";
      const formWithRelation = {
        ...sampleForm,
        schemaDefinition: {
          ...sampleForm.schemaDefinition,
          fields: [
            ...sampleForm.schemaDefinition.fields,
            {
              id: "f_project",
              type: "relation",
              label: "프로젝트",
              relationConfig: { multiple: false, targetFormId },
            },
          ],
        },
      };
      const projectForm = {
        id: targetFormId,
        title: "프로젝트 관리",
        schemaDefinition: {
          primaryFieldId: "project_name",
          fields: [{ id: "project_name", type: "text", label: "프로젝트명" }],
        },
      };

      mockLimit
        .mockResolvedValueOnce([formWithRelation])
        .mockResolvedValueOnce([projectForm])
        .mockResolvedValueOnce([{ id: subIdA }])
        .mockResolvedValueOnce([{ metricValue: 2000, totalCount: 1 }]);

      const filteredRes = await aggregateFormSubmissions({
        formId,
        metric: "sum",
        targetFieldId: "f_amount",
        timezone: "Asia/Seoul",
        filters: [{ fieldId: "f_project", value: "프로젝트 A" }],
        limit: 50,
      });

      expect(filteredRes.error).toBeNull();
      expect(filteredRes.data?.summaryValue).toBe(2000);
      expect(filteredRes.data?.totalCount).toBe(1);
    });

    it("timeBucket + startDate/endDate 조회 시 제출 건이 0건인 중간 월도 value: 0, count: 0으로 채워 연속 시계열을 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([sampleForm]);
      mockLimit.mockResolvedValueOnce([{ metricValue: 4000, totalCount: 2 }]);
      mockLimit.mockResolvedValueOnce([
        { timeKey: "2026-11", metricValue: 2000, totalCount: 1 },
        { timeKey: "2026-08", metricValue: 2000, totalCount: 1 },
      ]);

      const result = await aggregateFormSubmissions({
        formId,
        metric: "sum",
        targetFieldId: "f_amount",
        timeBucket: "month",
        dateFieldId: "f_expense_date",
        startDate: "2026-08-16",
        endDate: "2026-11-16",
        timezone: "Asia/Seoul",
        limit: 50,
      });

      expect(result.error).toBeNull();
      expect(result.data?.totalCount).toBe(2);
      expect(result.data?.summaryValue).toBe(4000);
      expect(result.data?.isTruncated).toBe(false);
      expect(result.data?.points).toEqual([
        { key: "2026-08", timeKey: "2026-08", value: 2000, count: 1 },
        { key: "2026-09", timeKey: "2026-09", value: 0, count: 0 },
        { key: "2026-10", timeKey: "2026-10", value: 0, count: 0 },
        { key: "2026-11", timeKey: "2026-11", value: 2000, count: 1 },
      ]);
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
        timezone: "Asia/Seoul",
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
