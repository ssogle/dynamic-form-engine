import { describe, expect, it } from "vitest";
import type { CoreFormField } from "@/entities/form";
import { formatFilterConditionSummary, resolveFilterFieldLabel } from "./filter-summary";

describe("filter-summary (manage-form-submissions/lib)", () => {
  const fields: CoreFormField[] = [
    {
      id: "f_cat",
      label: "카테고리",
      type: "select",
      required: true,
      description: "분류",
      options: [
        { label: "식대", value: "MEAL", description: "식사", disabled: false },
        { label: "구분류", value: "OLD", description: "비활성", disabled: true },
      ],
    },
    {
      id: "f_amount",
      label: "금액",
      type: "number",
      required: true,
      description: "금액",
    },
    {
      id: "f_switch",
      label: "승인 여부",
      type: "switch",
      required: false,
      description: "승인",
    },
    {
      id: "f_project",
      label: "프로젝트",
      type: "relation",
      required: false,
      description: "연결 프로젝트",
      relationConfig: { targetFormId: "11111111-1111-4111-8111-111111111111", multiple: false },
    },
  ];

  it("옵션 코드(비활성 옵션 포함), 숫자 범위, 불리언, 관계형 UUID를 가독성 있게 요약해야 한다", () => {
    expect(
      formatFilterConditionSummary(
        { fieldId: "f_cat", op: "in", values: ["MEAL", "OLD"] },
        fields[0]
      )
    ).toBe("식대, 구분류");

    expect(
      formatFilterConditionSummary(
        { fieldId: "f_amount", op: "between", min: 1000, max: 5000 },
        fields[1]
      )
    ).toBe("1000 ~ 5000");

    expect(
      formatFilterConditionSummary({ fieldId: "f_switch", op: "eq", value: true }, fields[2])
    ).toBe("예");

    expect(formatFilterConditionSummary({ fieldId: "f_switch", op: "isEmpty" }, fields[2])).toBe(
      "값 없음"
    );

    const relMap = new Map([["aaaa1111-1111-4111-a111-111111111111", "차세대 ERP"]]);
    expect(
      formatFilterConditionSummary(
        { fieldId: "f_project", op: "in", values: ["aaaa1111-1111-4111-a111-111111111111"] },
        fields[3],
        relMap
      )
    ).toBe("차세대 ERP");
  });

  it("resolveFilterFieldLabel은 시스템 컬럼과 도메인 필드 라벨을 정확히 반환해야 한다", () => {
    expect(resolveFilterFieldLabel("createdAt", fields)).toBe("제출 일시");
    expect(resolveFilterFieldLabel("f_cat", fields)).toBe("카테고리");
    expect(resolveFilterFieldLabel("unknown_id", fields)).toBe("unknown_id");
  });
});
