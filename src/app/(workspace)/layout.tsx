import type { ReactNode } from "react";
import { WorkspaceAppBar } from "./_components/workspace-app-bar";

/**
 * 작업 공간 공통 최상위 레이아웃 ((workspace))
 *
 * /builder, /consumer, /analyst 세 앱을 감싸는 공통 상위 쉘로,
 * 최상단에 글로벌 앱 전환 바(WorkspaceAppBar)를 고정하고 하단 가변 영역(min-h-0 flex-1)에
 * 각 앱 전용 좌우 분할 작업 공간을 렌더링합니다.
 */
export default function WorkspaceLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="bg-background flex h-screen w-full flex-col overflow-hidden">
      <WorkspaceAppBar />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
