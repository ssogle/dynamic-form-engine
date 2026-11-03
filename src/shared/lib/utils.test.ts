import { describe, expect, it } from "vitest";
import { cn } from "@/shared/lib/utils";

describe("cn utility", () => {
  it("클래스명들을 병합하여 반환해야 한다", () => {
    const result = cn("class-a", "class-b");
    expect(result).toBe("class-a class-b");
  });

  it("falsy 값(false, null, undefined)을 필터링해야 한다", () => {
    const result = cn("class-a", false, null, undefined, "class-b");
    expect(result).toBe("class-a class-b");
  });
});
