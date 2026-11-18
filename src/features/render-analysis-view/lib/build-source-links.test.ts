import { describe, expect, it } from "vitest";
import type { AnalysisBlock } from "@/entities/analysis-view";
import { buildBlockSourceLinks, buildRawDataHref } from "./build-source-links";

const FORM_A_ID = "11111111-1111-4111-8111-111111111111";
const FORM_B_ID = "22222222-2222-4222-8222-222222222222";

describe("build-source-links (render-analysis-view/lib)", () => {
  it("buildRawDataHref는 기간 및 날짜 필드 쿼리 파라미터를 URL에 안전하게 인코딩한다", () => {
    expect(buildRawDataHref({ formId: FORM_A_ID })).toBe(`/consumer/forms/${FORM_A_ID}`);

    expect(
      buildRawDataHref({
        formId: FORM_A_ID,
        startDate: "2026-02-01",
        endDate: "2026-02-28",
        dateFieldId: "occurred_at",
      })
    ).toBe(
      `/consumer/forms/${FORM_A_ID}?startDate=2026-02-01&endDate=2026-02-28&dateFieldId=occurred_at`
    );
  });

  it("buildBlockSourceLinks는 동일 폼/동일 기간 중복 링크를 제거하고 기간 쿼리 포함 URL을 생성한다", () => {
    const block: AnalysisBlock = {
      id: "chart-1",
      type: "chart",
      title: "수익 대 지출 비교",
      chartType: "bar",
      xAxisKey: "period",
      series: [
        { key: "revenue", label: "수익" },
        { key: "expense", label: "지출" },
      ],
      data: [{ period: "2026-02", revenue: 1000, expense: 400 }],
      sourceLinks: [
        {
          formId: FORM_A_ID,
          label: "매출 전표 원본",
          startDate: "2026-02-01",
          endDate: "2026-02-28",
          dateFieldId: "sale_date",
        },
        {
          formId: FORM_A_ID,
          label: "매출 전표 중복",
          startDate: "2026-02-01",
          endDate: "2026-02-28",
          dateFieldId: "sale_date",
        },
        {
          formId: FORM_B_ID,
          label: "지출 경비 내역",
          startDate: "2026-02-01",
          endDate: "2026-02-28",
          dateFieldId: "expense_date",
        },
      ],
    };

    const links = buildBlockSourceLinks(block);
    expect(links).toHaveLength(2);
    expect(links[0]?.label).toBe("매출 전표 원본");
    expect(links[0]?.href).toContain("startDate=2026-02-01");
    expect(links[1]?.label).toBe("지출 경비 내역");
    expect(links[1]?.href).toBe(
      `/consumer/forms/${FORM_B_ID}?startDate=2026-02-01&endDate=2026-02-28&dateFieldId=expense_date`
    );
  });

  it("동일 폼/동일 기간이더라도 filters 조건이 다르면 별도 링크로 보존하고 URL에 직렬화해야 한다", () => {
    const block: AnalysisBlock = {
      id: "table-filtered",
      type: "table",
      title: "카테고리별 내역",
      columns: [{ key: "k", label: "항목", align: "left" }],
      rows: [{ k: "A" }],
      sourceLinks: [
        {
          formId: FORM_A_ID,
          label: "식대 내역",
          startDate: "2026-02-01",
          endDate: "2026-02-28",
          filters: [{ fieldId: "f_cat", op: "in", values: ["MEAL"] }],
        },
        {
          formId: FORM_A_ID,
          label: "교통비 내역",
          startDate: "2026-02-01",
          endDate: "2026-02-28",
          filters: [{ fieldId: "f_cat", op: "in", values: ["TAXI"] }],
        },
      ],
    };

    const links = buildBlockSourceLinks(block);
    expect(links).toHaveLength(2);
    expect(links[0]?.href).toContain("filters=");
    expect(decodeURIComponent(links[0]!.href)).toContain("MEAL");
    expect(decodeURIComponent(links[1]!.href)).toContain("TAXI");
  });
});
