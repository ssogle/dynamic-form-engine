import { describe, expect, it } from "vitest";
import type { CoreFormField, Form } from "@/entities/form";
import {
  buildPickerFilterString,
  formatRelationCellValue,
  normalizeSelectedRelationIds,
  orderTargetColumns,
  removeRelationSelection,
  toggleRelationSelection,
} from "./relation-table";

describe("relation-table (features/render-dynamic-form/lib)", () => {
  const targetFields: CoreFormField[] = [
    {
      id: "p_code",
      label: "코드",
      type: "text",
      required: true,
      description: "프로젝트 식별 코드",
    },
    {
      id: "p_name",
      label: "프로젝트명",
      type: "text",
      required: true,
      description: "공식 프로젝트명",
    },
    {
      id: "p_status",
      label: "상태",
      type: "select",
      required: true,
      description: "진행 상태",
      options: [
        { label: "진행 중", value: "ACTIVE", description: "현재 수행 중인 상태", disabled: false },
        { label: "종료", value: "CLOSED", description: "완료된 상태", disabled: true },
      ],
    },
    {
      id: "p_active",
      label: "활성 여부",
      type: "switch",
      required: false,
      description: "활성 프로젝트 여부",
    },
  ];

  const targetForm: Form = {
    id: "form-target-1",
    title: "프로젝트 관리",
    description: "전사 프로젝트",
    schemaDefinition: {
      primaryFieldId: "p_name",
      fields: targetFields,
    },
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    deletedAt: null,
  };

  describe("normalizeSelectedRelationIds", () => {
    it("단일 문자열과 다중 배열을 중복 없는 정규화된 ID 배열로 변환해야 한다", () => {
      expect(normalizeSelectedRelationIds(undefined, false)).toEqual([]);
      expect(normalizeSelectedRelationIds("", false)).toEqual([]);
      expect(normalizeSelectedRelationIds("sub-1", false)).toEqual(["sub-1"]);
      expect(normalizeSelectedRelationIds(["sub-1", "sub-2"], false)).toEqual(["sub-1"]);
      expect(normalizeSelectedRelationIds(["sub-1", "sub-2", "sub-1", ""], true)).toEqual([
        "sub-1",
        "sub-2",
      ]);
      expect(normalizeSelectedRelationIds("sub-1", true)).toEqual(["sub-1"]);
    });
  });

  describe("toggleRelationSelection & removeRelationSelection", () => {
    it("단일 선택 모드에서는 선택한 ID 문자열을 반환하고 제거 시 undefined를 반환해야 한다", () => {
      expect(toggleRelationSelection({ currentIds: [], targetId: "sub-1", multiple: false })).toBe(
        "sub-1"
      );
      expect(
        toggleRelationSelection({ currentIds: ["sub-1"], targetId: "sub-2", multiple: false })
      ).toBe("sub-2");
      expect(
        removeRelationSelection({ currentIds: ["sub-1"], targetId: "sub-1", multiple: false })
      ).toBeUndefined();
    });

    it("다중 선택 모드에서는 배열 내 존재 여부를 토글하고 제거 시 남은 배열을 반환해야 한다", () => {
      expect(
        toggleRelationSelection({ currentIds: ["sub-1"], targetId: "sub-2", multiple: true })
      ).toEqual(["sub-1", "sub-2"]);
      expect(
        toggleRelationSelection({
          currentIds: ["sub-1", "sub-2"],
          targetId: "sub-1",
          multiple: true,
        })
      ).toEqual(["sub-2"]);
      expect(
        removeRelationSelection({
          currentIds: ["sub-1", "sub-2"],
          targetId: "sub-2",
          multiple: true,
        })
      ).toEqual(["sub-1"]);
    });
  });

  describe("orderTargetColumns", () => {
    it("타깃 폼의 대표 필드(primaryFieldId) 컬럼을 항상 가장 첫 번째 열로 배치해야 한다", () => {
      const ordered = orderTargetColumns(targetForm);
      expect(ordered.map((f) => f.id)).toEqual(["p_name", "p_code", "p_status", "p_active"]);
    });

    it("폼이 없거나 필드가 비어 있으면 빈 배열을 반환해야 한다", () => {
      expect(orderTargetColumns(null)).toEqual([]);
      expect(orderTargetColumns(undefined)).toEqual([]);
    });
  });

  describe("formatRelationCellValue", () => {
    it("옵션 value를 label로, boolean을 예/아니오로, 빈 값을 '-'로 포맷팅해야 한다", () => {
      expect(formatRelationCellValue("ACTIVE", targetFields[2]!)).toBe("진행 중");
      expect(formatRelationCellValue(true, targetFields[3]!)).toBe("예");
      expect(formatRelationCellValue(false, targetFields[3]!)).toBe("아니오");
      expect(formatRelationCellValue(undefined, targetFields[0]!)).toBe("-");
      expect(formatRelationCellValue("", targetFields[0]!)).toBe("-");
      expect(formatRelationCellValue("ERP-01", targetFields[0]!)).toBe("ERP-01");
    });
  });

  describe("buildPickerFilterString", () => {
    it("대표 필드 빠른 검색어와 개별 컬럼 필터를 결합해 표준 FieldFilterCondition[] JSON 문자열을 생성해야 한다", () => {
      const result = buildPickerFilterString({
        primaryFieldId: "p_name",
        primaryFieldType: "text",
        searchQuery: "차세대",
        columnFilters: { p_code: "ERP", p_empty: "  " },
      });

      expect(result).toBeDefined();
      expect(JSON.parse(result!)).toEqual([
        { fieldId: "p_code", op: "contains", value: "ERP" },
        { fieldId: "p_name", op: "contains", value: "차세대" },
      ]);
    });

    it("모든 필터와 검색어가 비어 있으면 undefined를 반환해야 한다", () => {
      expect(
        buildPickerFilterString({
          primaryFieldId: "p_name",
          searchQuery: "   ",
          columnFilters: {},
        })
      ).toBeUndefined();
    });
  });
});
