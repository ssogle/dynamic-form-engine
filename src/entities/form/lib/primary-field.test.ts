import { describe, expect, it } from "vitest";
import type { Form } from "../schema/form.schema";
import type { CoreFormField } from "../schema/form-field.schema";
import {
  extractPrimaryFieldId,
  extractPrimaryFieldValue,
  orderFieldsWithPrimaryFirst,
  validatePrimaryFieldSelection,
} from "./primary-field";

describe("primary-field (entities/form/lib)", () => {
  const baseFields: CoreFormField[] = [
    {
      id: "f_code",
      label: "프로젝트 코드",
      type: "text",
      required: true,
      description: "프로젝트 식별 코드를 입력합니다.",
    },
    {
      id: "f_status",
      label: "진행 상태",
      type: "select",
      required: true,
      description: "프로젝트의 현재 상태를 선택합니다.",
      options: [
        {
          label: "진행 중",
          value: "ACTIVE",
          description: "현재 활발히 수행 중인 프로젝트입니다.",
          disabled: false,
        },
        {
          label: "중단됨",
          value: "PAUSED",
          description: "과거에 일시 중단된 상태입니다.",
          disabled: true,
        },
      ],
    },
    {
      id: "f_is_urgent",
      label: "긴급 여부",
      type: "switch",
      required: false,
      description: "긴급 처리 대상인지 여부를 표시합니다.",
    },
    {
      id: "f_tags",
      label: "적용 분야",
      type: "checkbox",
      required: false,
      description: "복수 분야를 선택합니다.",
      options: [
        {
          label: "웹",
          value: "WEB",
          description: "웹 서비스 구축 프로젝트입니다.",
          disabled: false,
        },
      ],
    },
    {
      id: "f_parent",
      label: "상위 프로그램",
      type: "relation",
      required: false,
      description: "연관된 상위 프로그램을 연결합니다.",
      relationConfig: {
        targetFormId: "11111111-1111-4111-a111-111111111111",
        multiple: false,
      },
    },
    {
      id: "f_deleted",
      label: "과거 필드",
      type: "text",
      required: false,
      description: "이미 소프트 삭제된 필드입니다.",
      deletedAt: "2026-11-10T00:00:00.000Z",
    },
  ];

  const sampleForm: Form = {
    id: "22222222-2222-4222-a222-222222222222",
    title: "프로젝트 관리",
    description: "전사 프로젝트 목록",
    schemaDefinition: {
      primaryFieldId: "f_code",
      fields: baseFields as unknown as Array<Record<string, unknown>>,
    },
    publishedAt: new Date("2026-11-01T00:00:00Z"),
    createdAt: new Date("2026-11-01T00:00:00Z"),
    updatedAt: new Date("2026-11-01T00:00:00Z"),
    deletedAt: null,
  };

  describe("validatePrimaryFieldSelection", () => {
    it("활성 상태의 스칼라 필드(text, select, switch 등)를 대표 필드로 지정하면 통과해야 한다", () => {
      expect(validatePrimaryFieldSelection(baseFields, "f_code").isValid).toBe(true);
      expect(validatePrimaryFieldSelection(baseFields, "f_status").isValid).toBe(true);
      expect(validatePrimaryFieldSelection(baseFields, "f_is_urgent").isValid).toBe(true);
    });

    it("대표 필드 ID가 비어있거나 공백이면 실패해야 한다", () => {
      expect(validatePrimaryFieldSelection(baseFields, undefined).isValid).toBe(false);
      expect(validatePrimaryFieldSelection(baseFields, "   ").isValid).toBe(false);
    });

    it("존재하지 않거나 소프트 삭제(deletedAt)된 필드를 대표 필드로 지정하면 실패해야 한다", () => {
      expect(validatePrimaryFieldSelection(baseFields, "nonexistent").isValid).toBe(false);
      expect(validatePrimaryFieldSelection(baseFields, "f_deleted").isValid).toBe(false);
    });

    it("다중 선택(checkbox) 또는 관계형(relation) 필드는 대표 필드로 지정할 수 없어야 한다", () => {
      const checkboxRes = validatePrimaryFieldSelection(baseFields, "f_tags");
      const relationRes = validatePrimaryFieldSelection(baseFields, "f_parent");

      expect(checkboxRes.isValid).toBe(false);
      expect(relationRes.isValid).toBe(false);
    });
  });

  describe("extractPrimaryFieldId", () => {
    it("폼 스키마에 정의된 유효한 활성 primaryFieldId를 추출해야 한다", () => {
      expect(extractPrimaryFieldId(sampleForm)).toBe("f_code");
    });

    it("primaryFieldId가 누락되거나 삭제된 필드를 가리키는 경우 undefined를 반환해야 한다", () => {
      const noPrimaryForm: Form = {
        ...sampleForm,
        schemaDefinition: {
          fields: baseFields as unknown as Array<Record<string, unknown>>,
        },
      };
      const deletedPrimaryForm: Form = {
        ...sampleForm,
        schemaDefinition: {
          primaryFieldId: "f_deleted",
          fields: baseFields as unknown as Array<Record<string, unknown>>,
        },
      };

      expect(extractPrimaryFieldId(noPrimaryForm)).toBeUndefined();
      expect(extractPrimaryFieldId(deletedPrimaryForm)).toBeUndefined();
      expect(extractPrimaryFieldId(null)).toBeUndefined();
    });
  });

  describe("extractPrimaryFieldValue", () => {
    it("텍스트 대표 필드의 값을 문자열로 반환해야 한다", () => {
      const text = extractPrimaryFieldValue(sampleForm, {
        id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
        data: { f_code: "PRJ-2026-01" },
      });

      expect(text).toBe("PRJ-2026-01");
    });

    it("선택형(select/radio) 대표 필드의 경우 내부 코드가 아닌 옵션 라벨(비활성 옵션 포함)을 반환해야 한다", () => {
      const statusForm: Form = {
        ...sampleForm,
        schemaDefinition: {
          ...sampleForm.schemaDefinition,
          primaryFieldId: "f_status",
        },
      };

      expect(
        extractPrimaryFieldValue(statusForm, {
          id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
          data: { f_status: "ACTIVE" },
        })
      ).toBe("진행 중");

      expect(
        extractPrimaryFieldValue(statusForm, {
          id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
          data: { f_status: "PAUSED" },
        })
      ).toBe("중단됨");
    });

    it("스위치(switch) 대표 필드의 불리언 값은 예/아니오로 변환해야 한다", () => {
      const switchForm: Form = {
        ...sampleForm,
        schemaDefinition: {
          ...sampleForm.schemaDefinition,
          primaryFieldId: "f_is_urgent",
        },
      };

      expect(
        extractPrimaryFieldValue(switchForm, {
          id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
          data: { f_is_urgent: true },
        })
      ).toBe("예");
      expect(
        extractPrimaryFieldValue(switchForm, {
          id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
          data: { f_is_urgent: false },
        })
      ).toBe("아니오");
    });

    it("대표 필드 값이 비어있으면 응답 UUID 앞 8자리를 포함한 폴백 문자열을 반환해야 한다", () => {
      const text = extractPrimaryFieldValue(sampleForm, {
        id: "12345678-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
        data: { f_code: "   " },
      });

      expect(text).toBe("레코드 (12345678)");
    });
  });

  describe("orderFieldsWithPrimaryFirst", () => {
    it("활성 필드 중 primaryFieldId에 해당하는 컬럼을 항상 첫 번째 위치로 이동시켜 반환해야 한다", () => {
      const formWithSecondPrimary: Form = {
        ...sampleForm,
        schemaDefinition: {
          ...sampleForm.schemaDefinition,
          primaryFieldId: "f_status",
        },
      };

      const ordered = orderFieldsWithPrimaryFirst(formWithSecondPrimary);
      expect(ordered.map((f) => f.id)).toEqual([
        "f_status",
        "f_code",
        "f_is_urgent",
        "f_tags",
        "f_parent",
      ]);
    });

    it("유효한 primaryFieldId가 없으면 일반 활성 필드 순서를 유지하고 폼이 없으면 빈 배열을 반환해야 한다", () => {
      const brokenPrimaryForm: Form = {
        ...sampleForm,
        schemaDefinition: {
          ...sampleForm.schemaDefinition,
          primaryFieldId: "f_deleted",
        },
      };

      expect(orderFieldsWithPrimaryFirst(brokenPrimaryForm).map((f) => f.id)).toEqual([
        "f_code",
        "f_status",
        "f_is_urgent",
        "f_tags",
        "f_parent",
      ]);
      expect(orderFieldsWithPrimaryFirst(null)).toEqual([]);
    });
  });
});
