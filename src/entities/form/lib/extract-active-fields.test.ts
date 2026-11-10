import { describe, it, expect } from "vitest";
import type { Form } from "../schema/form.schema";
import type { ActiveForm, CoreFormField } from "../schema/form-field.schema";
import { extractActiveFields } from "./extract-active-fields";

describe("extractActiveFields (entities/form/lib)", () => {
  const sampleField: CoreFormField = {
    id: "f1",
    label: "제목",
    type: "text",
    required: true,
  };

  const deletedField: CoreFormField = {
    id: "f2",
    label: "과거 필드",
    type: "text",
    required: false,
    deletedAt: "2026-01-01T00:00:00.000Z",
  };

  it("form이 null 또는 undefined인 경우 빈 배열을 안전하게 반환해야 한다", () => {
    expect(extractActiveFields(null)).toEqual([]);
    expect(extractActiveFields(undefined)).toEqual([]);
  });

  it("ActiveForm 규격(fields 배열 소유)에서 소프트 삭제되지 않은 활성 필드만 추출해야 한다", () => {
    const activeForm: ActiveForm = {
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      title: "샘플 폼",
      fields: [sampleField, deletedField],
    };

    const result = extractActiveFields(activeForm);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("f1");
  });

  it("DB Form 모델(schemaDefinition.fields 소유)에서 소프트 삭제되지 않은 활성 필드만 추출해야 한다", () => {
    const dbForm: Form = {
      id: "form-uuid-1",
      title: "DB 저장 폼",
      description: null,
      schemaDefinition: {
        fields: [sampleField, deletedField],
      },
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      deletedAt: null,
    };

    const result = extractActiveFields(dbForm);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("f1");
  });

  it("schemaDefinition 내 fields가 배열이 아니거나 비어있는 경우 빈 배열을 반환해야 한다", () => {
    const malformedForm = {
      id: "malformed",
      slug: "malformed",
      title: "비정상 폼",
      description: null,
      schemaDefinition: { fields: "not-an-array" as unknown as [] },
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } as unknown as Form;

    expect(extractActiveFields(malformedForm)).toEqual([]);
  });
});
