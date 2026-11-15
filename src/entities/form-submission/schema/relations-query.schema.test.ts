import { describe, expect, it } from "vitest";
import { relationsQuerySchema } from "./submission-query.schema";

describe("relationsQuerySchema", () => {
  it("accepts valid UUID targetId query parameters", () => {
    const validId = "550e8400-e29b-41d4-a716-446655440000";
    const parsed = relationsQuerySchema.safeParse({ targetId: validId });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({ targetId: validId });
    }
  });

  it("rejects missing or invalid UUID targetId query parameters", () => {
    const missingResult = relationsQuerySchema.safeParse({});
    expect(missingResult.success).toBe(false);

    const invalidResult = relationsQuerySchema.safeParse({ targetId: "not-a-uuid" });
    expect(invalidResult.success).toBe(false);
  });
});
