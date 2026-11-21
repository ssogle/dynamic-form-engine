import { describe, expect, it } from "vitest";
import type { CoreFormField, Form } from "@/entities/form";
import type { FormSubmission } from "@/entities/form-submission";
import {
  buildRelationLookupMap,
  extractRelationTargets,
  formatRelationSummaryCell,
  getRelationDetailRows,
} from "./relation-summary";

describe("relation-summary (features/manage-form-submissions/lib)", () => {
  const targetFormId = "22222222-2222-4222-a222-222222222222";
  const subAId = "aaaa1111-1111-4111-a111-111111111111";
  const subBId = "bbbb2222-2222-4222-a222-222222222222";
  const subMissingId = "cccc3333-3333-4333-a333-333333333333";

  const targetForm: Form = {
    id: targetFormId,
    title: "프로젝트 마스터",
    description: "전사 프로젝트",
    schemaDefinition: {
      primaryFieldId: "p_name",
      fields: [
        {
          id: "p_code",
          label: "코드",
          type: "text",
          required: true,
          description: "코드",
        },
        {
          id: "p_name",
          label: "프로젝트명",
          type: "text",
          required: true,
          description: "공식 프로젝트명",
        },
      ],
    },
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    version: 1,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    deletedAt: null,
  };

  const singleRelField: CoreFormField = {
    id: "f_project",
    label: "참조 프로젝트",
    type: "relation",
    required: true,
    description: "귀속 프로젝트 연결",
    relationConfig: {
      targetFormId,
      multiple: false,
    },
  };

  const multiRelField: CoreFormField = {
    id: "f_projects",
    label: "관련 프로젝트들",
    type: "relation",
    required: false,
    description: "다중 프로젝트 연결",
    relationConfig: {
      targetFormId,
      multiple: true,
    },
  };

  const parentSubmissions: FormSubmission[] = [
    {
      id: "parent-1",
      formId: "parent-form",
      version: 1,
      data: {
        f_project: subAId,
        f_projects: [subAId, subBId],
      },
      createdAt: new Date("2026-01-02T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
      deletedAt: null,
    },
    {
      id: "parent-2",
      formId: "parent-form",
      version: 1,
      data: {
        f_project: subBId,
        f_projects: [subAId],
      },
      createdAt: new Date("2026-01-02T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
      deletedAt: null,
    },
  ];

  const targetSubmissions: FormSubmission[] = [
    {
      id: subAId,
      formId: targetFormId,
      version: 1,
      data: { p_code: "PRJ-01", p_name: "차세대 ERP 구축" },
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      deletedAt: null,
    },
    {
      id: subBId,
      formId: targetFormId,
      version: 1,
      data: { p_code: "PRJ-02", p_name: "AI 검색 고도화" },
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      deletedAt: null,
    },
  ];

  describe("extractRelationTargets", () => {
    it("활성 관계형 필드에서 참조된 타깃 폼별 중복 제거된 서브미션 ID 목록을 추출해야 한다", () => {
      const targets = extractRelationTargets([singleRelField, multiRelField], parentSubmissions);
      expect(targets).toEqual([
        {
          targetFormId,
          submissionIds: [subAId, subBId],
        },
      ]);
    });

    it("관계형 필드가 없거나 선택값이 비어 있으면 빈 배열을 반환해야 한다", () => {
      expect(extractRelationTargets([], parentSubmissions)).toEqual([]);
      expect(
        extractRelationTargets(
          [singleRelField],
          [
            {
              ...parentSubmissions[0]!,
              data: {},
            },
          ]
        )
      ).toEqual([{ targetFormId, submissionIds: [] }]);
    });

    it("서브미션 행이 0건이어도 활성 필터 조건의 유효한 relation UUID는 룩업 대상에 포함해야 한다", () => {
      const targets = extractRelationTargets(
        [singleRelField],
        [],
        [
          { fieldId: "f_project", op: "in", values: [subMissingId] },
          { fieldId: "f_project", op: "eq", value: subAId },
          { fieldId: "f_project", op: "contains", value: "키워드" },
        ]
      );
      expect(targets).toEqual([
        {
          targetFormId,
          submissionIds: [subAId, subMissingId],
        },
      ]);
    });
  });

  describe("buildRelationLookupMap & formatRelationSummaryCell", () => {
    it("단일 선택은 타깃 대표 필드 값을, 다중 선택은 '대표값 외 N건' 요약 문자열을 반환해야 한다", () => {
      const lookup = buildRelationLookupMap([targetForm], targetSubmissions);

      expect(formatRelationSummaryCell(subAId, singleRelField, lookup)).toBe("차세대 ERP 구축");
      expect(formatRelationSummaryCell([subAId, subBId], multiRelField, lookup)).toBe(
        "차세대 ERP 구축 외 1건"
      );
      expect(formatRelationSummaryCell([subBId], multiRelField, lookup)).toBe("AI 검색 고도화");
      expect(formatRelationSummaryCell(undefined, singleRelField, lookup)).toBe("-");
      expect(formatRelationSummaryCell([], multiRelField, lookup)).toBe("-");
    });

    it("타깃 레코드가 아직 조회되지 않았거나 삭제된 경우 전체 UUID로 안전하게 폴백해야 한다", () => {
      const lookup = buildRelationLookupMap([targetForm], targetSubmissions);
      expect(formatRelationSummaryCell(subMissingId, singleRelField, lookup)).toBe(subMissingId);
    });
  });

  describe("getRelationDetailRows", () => {
    it("선택된 타깃 레코드 행 배열과 미조회 ID 목록을 순서대로 반환해야 한다", () => {
      const lookup = buildRelationLookupMap([targetForm], targetSubmissions);
      const result = getRelationDetailRows([subBId, subMissingId, subAId], multiRelField, lookup);

      expect(result.targetForm?.id).toBe(targetFormId);
      expect(result.rows.map((r) => r.id)).toEqual([subBId, subAId]);
      expect(result.missingIds).toEqual([subMissingId]);
    });
  });
});
