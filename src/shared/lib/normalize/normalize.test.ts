import { describe, expect, it } from "vitest";
import { normalizeStringIds } from "@/shared/lib/normalize";

describe("Normalize Utilities (shared/lib/normalize)", () => {
  const validUuidLower = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

  describe("normalizeStringIds", () => {
    it("단일 문자열 입력의 앞뒤 공백을 제거하여 단일 원소 배열로 반환해야 한다", () => {
      expect(normalizeStringIds(`  ${validUuidLower}  `)).toEqual([validUuidLower]);
      expect(normalizeStringIds("   ")).toEqual([]);
      expect(normalizeStringIds("")).toEqual([]);
    });

    it("배열 입력에서 비어있는 값·비문자열·중복을 제거하고 순서를 유지해야 한다", () => {
      expect(normalizeStringIds([" sub-1 ", "", null, 42, "sub-2", "sub-1", "   "])).toEqual([
        "sub-1",
        "sub-2",
      ]);
    });

    it("maxItems 옵션 지정 시 최대 개수까지만 절삭하여 반환해야 한다", () => {
      expect(normalizeStringIds(["a", "b", "c"], { maxItems: 1 })).toEqual(["a"]);
      expect(normalizeStringIds(["a", "b", "c"], { maxItems: 2 })).toEqual(["a", "b"]);
    });

    it("지원하지 않는 비정상 타입이 유입되면 빈 배열을 반환해야 한다", () => {
      expect(normalizeStringIds(null)).toEqual([]);
      expect(normalizeStringIds(undefined)).toEqual([]);
      expect(normalizeStringIds({ id: validUuidLower })).toEqual([]);
    });
  });
});
