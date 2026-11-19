import { describe, expect, it } from "vitest";
import { validateFormSchemaTransition } from "./validate-form-schema-transition";
import type { CoreFormField } from "../schema/form-field.schema";

const BASE_FIELDS: CoreFormField[] = [
  {
    id: "f_title",
    label: "제목",
    type: "text",
    required: true,
    description: "항목의 대표 제목입니다.",
  },
  {
    id: "f_category",
    label: "카테고리",
    type: "select",
    required: true,
    multiple: true,
    description: "항목 분류입니다.",
    options: [
      { label: "개발", value: "DEV", description: "개발 업무", disabled: false },
      { label: "디자인", value: "DESIGN", description: "디자인 업무", disabled: false },
    ],
  },
  {
    id: "f_project",
    label: "프로젝트",
    type: "relation",
    required: false,
    description: "연관 프로젝트입니다.",
    relationConfig: {
      targetFormId: "11111111-1111-4111-a111-111111111111",
      multiple: true,
    },
  },
];

describe("validateFormSchemaTransition (발행 상태 및 응답 무결성 스키마 변경 보호)", () => {
  it("메타데이터(제목/설명)만 변경하고 nextSchemaDefinition이 없으면 발행 중에도 통과해야 한다", () => {
    const result = validateFormSchemaTransition({
      existingForm: {
        publishedAt: new Date("2026-11-19T00:00:00Z"),
        schemaDefinition: { primaryFieldId: "f_title", fields: BASE_FIELDS },
      },
      nextSchemaDefinition: undefined,
      hasSubmissions: true,
    });

    expect(result).toEqual({ data: null, error: null });
  });

  it("발행 중(publishedAt !== null)인 폼의 스키마 변경 요청은 차단해야 한다", () => {
    const result = validateFormSchemaTransition({
      existingForm: {
        publishedAt: new Date("2026-11-19T00:00:00Z"),
        schemaDefinition: { primaryFieldId: "f_title", fields: BASE_FIELDS },
      },
      nextSchemaDefinition: {
        primaryFieldId: "f_title",
        fields: [
          ...BASE_FIELDS,
          {
            id: "f_note",
            label: "비고",
            type: "textarea",
            required: false,
            description: "추가 비고",
          },
        ],
      },
      hasSubmissions: false,
    });

    expect(result.error).toContain("발행");
  });

  it("초안 상태이고 응답이 0건이면 필드 물리 삭제, 타입 변경, multiple 축소를 모두 허용해야 한다", () => {
    const result = validateFormSchemaTransition({
      existingForm: {
        publishedAt: null,
        schemaDefinition: { primaryFieldId: "f_title", fields: BASE_FIELDS },
      },
      nextSchemaDefinition: {
        primaryFieldId: "f_title",
        fields: [
          BASE_FIELDS[0]!,
          {
            ...BASE_FIELDS[1]!,
            type: "radio",
            multiple: false,
            options: [{ label: "개발", value: "DEV", description: "개발 업무", disabled: false }],
          },
        ],
      },
      hasSubmissions: false,
    });

    expect(result.error).toBeNull();
  });

  it("초안 상태이고 응답이 1건 이상이면 기존 필드 물리 삭제를 차단해야 한다", () => {
    const result = validateFormSchemaTransition({
      existingForm: {
        publishedAt: null,
        schemaDefinition: { primaryFieldId: "f_title", fields: BASE_FIELDS },
      },
      nextSchemaDefinition: {
        primaryFieldId: "f_title",
        fields: [BASE_FIELDS[0]!, BASE_FIELDS[1]!],
      },
      hasSubmissions: true,
    });

    expect(result.error).toContain("물리 삭제");
  });

  it("초안 상태이고 응답이 1건 이상이면 기존 필드의 deletedAt 소프트 삭제와 신규 필드 추가는 허용해야 한다", () => {
    const result = validateFormSchemaTransition({
      existingForm: {
        publishedAt: null,
        schemaDefinition: { primaryFieldId: "f_title", fields: BASE_FIELDS },
      },
      nextSchemaDefinition: {
        primaryFieldId: "f_title",
        fields: [
          BASE_FIELDS[0]!,
          BASE_FIELDS[1]!,
          { ...BASE_FIELDS[2]!, deletedAt: "2026-11-19T10:00:00.000Z" },
          {
            id: "f_amount",
            label: "금액",
            type: "number",
            required: false,
            description: "관련 금액",
          },
        ],
      },
      hasSubmissions: true,
    });

    expect(result.error).toBeNull();
  });

  it("초안 상태이고 응답이 1건 이상이면 기존 필드의 type 변경을 차단해야 한다", () => {
    const result = validateFormSchemaTransition({
      existingForm: {
        publishedAt: null,
        schemaDefinition: { primaryFieldId: "f_title", fields: BASE_FIELDS },
      },
      nextSchemaDefinition: {
        primaryFieldId: "f_title",
        fields: [{ ...BASE_FIELDS[0]!, type: "number" }, BASE_FIELDS[1]!, BASE_FIELDS[2]!],
      },
      hasSubmissions: true,
    });

    expect(result.error).toContain("타입");
  });

  it("초안 상태이고 응답이 1건 이상이면 relation targetFormId 변경 및 multiple: true -> false 축소를 차단해야 한다", () => {
    const changedTarget = validateFormSchemaTransition({
      existingForm: {
        publishedAt: null,
        schemaDefinition: { primaryFieldId: "f_title", fields: BASE_FIELDS },
      },
      nextSchemaDefinition: {
        primaryFieldId: "f_title",
        fields: [
          BASE_FIELDS[0]!,
          BASE_FIELDS[1]!,
          {
            ...BASE_FIELDS[2]!,
            relationConfig: {
              targetFormId: "22222222-2222-4222-a222-222222222222",
              multiple: true,
            },
          },
        ],
      },
      hasSubmissions: true,
    });
    expect(changedTarget.error).toContain("참조 대상");

    const shrunkRelation = validateFormSchemaTransition({
      existingForm: {
        publishedAt: null,
        schemaDefinition: { primaryFieldId: "f_title", fields: BASE_FIELDS },
      },
      nextSchemaDefinition: {
        primaryFieldId: "f_title",
        fields: [
          BASE_FIELDS[0]!,
          BASE_FIELDS[1]!,
          {
            ...BASE_FIELDS[2]!,
            relationConfig: {
              targetFormId: "11111111-1111-4111-a111-111111111111",
              multiple: false,
            },
          },
        ],
      },
      hasSubmissions: true,
    });
    expect(shrunkRelation.error).toContain("다중");
  });

  it("초안 상태이고 응답이 1건 이상이면 select multiple: true -> false 축소 및 옵션 물리 삭제를 차단해야 한다", () => {
    const shrunkSelect = validateFormSchemaTransition({
      existingForm: {
        publishedAt: null,
        schemaDefinition: { primaryFieldId: "f_title", fields: BASE_FIELDS },
      },
      nextSchemaDefinition: {
        primaryFieldId: "f_title",
        fields: [BASE_FIELDS[0]!, { ...BASE_FIELDS[1]!, multiple: false }, BASE_FIELDS[2]!],
      },
      hasSubmissions: true,
    });
    expect(shrunkSelect.error).toContain("다중");

    const removedOption = validateFormSchemaTransition({
      existingForm: {
        publishedAt: null,
        schemaDefinition: { primaryFieldId: "f_title", fields: BASE_FIELDS },
      },
      nextSchemaDefinition: {
        primaryFieldId: "f_title",
        fields: [
          BASE_FIELDS[0]!,
          {
            ...BASE_FIELDS[1]!,
            options: [{ label: "개발", value: "DEV", description: "개발 업무", disabled: false }],
          },
          BASE_FIELDS[2]!,
        ],
      },
      hasSubmissions: true,
    });
    expect(removedOption.error).toContain("선택지");
  });

  it("초안 상태이고 응답이 1건 이상이라도 select/relation false -> true 확장 및 옵션 비활성화(disabled: true)는 허용해야 한다", () => {
    const singleBase: CoreFormField[] = [
      BASE_FIELDS[0]!,
      { ...BASE_FIELDS[1]!, multiple: false },
      {
        ...BASE_FIELDS[2]!,
        relationConfig: {
          targetFormId: "11111111-1111-4111-a111-111111111111",
          multiple: false,
        },
      },
    ];

    const expanded = validateFormSchemaTransition({
      existingForm: {
        publishedAt: null,
        schemaDefinition: { primaryFieldId: "f_title", fields: singleBase },
      },
      nextSchemaDefinition: {
        primaryFieldId: "f_title",
        fields: [
          BASE_FIELDS[0]!,
          {
            ...BASE_FIELDS[1]!,
            multiple: true,
            options: [
              { label: "개발", value: "DEV", description: "개발 업무", disabled: false },
              { label: "디자인", value: "DESIGN", description: "디자인 업무", disabled: true },
            ],
          },
          {
            ...BASE_FIELDS[2]!,
            relationConfig: {
              targetFormId: "11111111-1111-4111-a111-111111111111",
              multiple: true,
            },
          },
        ],
      },
      hasSubmissions: true,
    });

    expect(expanded.error).toBeNull();
  });
});
