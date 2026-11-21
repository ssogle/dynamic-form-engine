import type { AnalysisBlock } from "@/entities/analysis-view";

/**
 * 직전 블록 배열 스냅샷과 최신 블록 배열을 비교해 포커스·하이라이트 대상 블록 ID를 결정합니다.
 *
 * 우선순위:
 * 1) 새로 추가되거나 내용이 변경된 첫 번째 블록
 * 2) 블록 집합은 동일하나 순서가 변경된(`REORDER_BLOCKS`) 경우 위치가 바뀐 첫 번째 블록
 * 3) 단순 삭제만 발생했거나 변경이 없으면 `null` 반환
 */
export function detectChangedAnalysisBlockId(
  prevSnapshots: ReadonlyMap<string, string>,
  prevOrder: readonly string[],
  nextBlocks: readonly AnalysisBlock[]
): {
  changedBlockId: string | null;
  nextSnapshots: Map<string, string>;
  nextOrder: string[];
} {
  const nextSnapshots = new Map<string, string>(
    nextBlocks.map((block) => [block.id, JSON.stringify(block)])
  );
  const nextOrder = nextBlocks.map((block) => block.id);

  for (const block of nextBlocks) {
    if (prevSnapshots.get(block.id) !== nextSnapshots.get(block.id)) {
      return { changedBlockId: block.id, nextSnapshots, nextOrder };
    }
  }

  // 삭제만으로 인한 배열 인덱스 밀림을 오탐하지 않도록 블록 집합 크기가 동일할 때만 순서 변경을 검사합니다.
  if (prevOrder.length === nextOrder.length && prevSnapshots.size === nextSnapshots.size) {
    for (let i = 0; i < nextOrder.length; i += 1) {
      const nextId = nextOrder[i];
      if (nextId && nextId !== prevOrder[i]) {
        return { changedBlockId: nextId, nextSnapshots, nextOrder };
      }
    }
  }

  return { changedBlockId: null, nextSnapshots, nextOrder };
}
