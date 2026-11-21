import { describe, expect, it } from "vitest";
import { isUuid, uuidSchema } from "@/shared/schema";

describe("UUID Schema & Predicate (shared/schema/uuid.schema)", () => {
  const validLower = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

  it("isUuid는 표준 UUID(대소문자·앞뒤 공백 포함)에 대해 true를 반환해야 한다", () => {
    expect(isUuid(validLower)).toBe(true);
    expect(isUuid(`  ${validLower.toUpperCase()}  `)).toBe(true);
  });

  it("isUuid는 키워드 문자열, 샘플 ID, 비표준 더미 문자열, 비문자열에 대해 false를 반환해야 한다", () => {
    expect(isUuid("차세대 ERP")).toBe(false);
    expect(isUuid("sample-preview-1")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid("   ")).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(12345)).toBe(false);
  });

  it("uuidSchema는 유효한 UUID 문자열을 통과시키고 비UUID는 거부해야 한다", () => {
    expect(uuidSchema.safeParse(validLower).success).toBe(true);
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});
