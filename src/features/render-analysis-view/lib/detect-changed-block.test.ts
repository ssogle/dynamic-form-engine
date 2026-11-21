import { describe, expect, it } from "vitest";
import type { AnalysisBlock } from "@/entities/analysis-view";
import { detectChangedAnalysisBlockId } from "./detect-changed-block";

function makeTextBlock(id: string, content: string): AnalysisBlock {
  return {
    id,
    type: "text",
    title: `제목 ${id}`,
    content,
  };
}

describe("detectChangedAnalysisBlockId", () => {
  it("새 블록이 추가되면 추가된 블록 ID를 반환한다", () => {
    const initial = [makeTextBlock("b1", "요약 1")];
    const snap = new Map(initial.map((b) => [b.id, JSON.stringify(b)]));
    const next = [...initial, makeTextBlock("b2", "요약 2")];

    const res = detectChangedAnalysisBlockId(snap, ["b1"], next);
    expect(res.changedBlockId).toBe("b2");
  });

  it("기존 블록 내용이 수정되면 수정된 블록 ID를 반환한다", () => {
    const initial = [makeTextBlock("b1", "원본 1"), makeTextBlock("b2", "원본 2")];
    const snap = new Map(initial.map((b) => [b.id, JSON.stringify(b)]));
    const next = [initial[0]!, makeTextBlock("b2", "수정됨 2")];

    const res = detectChangedAnalysisBlockId(snap, ["b1", "b2"], next);
    expect(res.changedBlockId).toBe("b2");
  });

  it("동일 블록 집합에서 순서만 변경되면 이동된 첫 번째 블록 ID를 반환한다", () => {
    const b1 = makeTextBlock("b1", "1번");
    const b2 = makeTextBlock("b2", "2번");
    const snap = new Map([b1, b2].map((b) => [b.id, JSON.stringify(b)]));

    const res = detectChangedAnalysisBlockId(snap, ["b1", "b2"], [b2, b1]);
    expect(res.changedBlockId).toBe("b2");
  });

  it("블록 삭제만 발생한 경우에는 인덱스 밀림으로 오탐하지 않고 null을 반환한다", () => {
    const b1 = makeTextBlock("b1", "1번");
    const b2 = makeTextBlock("b2", "2번");
    const snap = new Map([b1, b2].map((b) => [b.id, JSON.stringify(b)]));

    const res = detectChangedAnalysisBlockId(snap, ["b1", "b2"], [b2]);
    expect(res.changedBlockId).toBeNull();
  });

  it("변경 사항이 전혀 없으면 null을 반환한다", () => {
    const b1 = makeTextBlock("b1", "1번");
    const snap = new Map([[b1.id, JSON.stringify(b1)]]);

    const res = detectChangedAnalysisBlockId(snap, ["b1"], [makeTextBlock("b1", "1번")]);
    expect(res.changedBlockId).toBeNull();
  });
});
