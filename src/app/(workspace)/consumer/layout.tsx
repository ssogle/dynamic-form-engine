import type { ReactNode } from "react";
import { WorkspaceSplitShell } from "../_components/workspace-split-shell";

/**
 * 컨슈머(응답자 및 뷰어) 작업 공간 대칭 레이아웃
 *
 * 최상위 WorkspaceLayout의 글로벌 앱 바 하단 영역(h-full)을 채우며,
 * 좌측 Consumer AI Navigator 패널과 우측 포털/참여 캔버스를 렌더링합니다.
 */
export default function ConsumerLayout({ children }: { readonly children: ReactNode }) {
  return <WorkspaceSplitShell mode="consumer">{children}</WorkspaceSplitShell>;
}
