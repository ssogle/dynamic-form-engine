import type { ReactNode } from "react";
import { WorkspaceSplitShell } from "../_components/workspace-split-shell";

/**
 * 빌더 작업 공간 레이아웃
 *
 * 최상위 WorkspaceLayout의 글로벌 앱 바 하단 영역(h-full)을 채우며,
 * 좌측 Builder AI Navigator 패널과 우측 캔버스 영역을 렌더링합니다.
 */
export default function BuilderLayout({ children }: { readonly children: ReactNode }) {
  return <WorkspaceSplitShell mode="builder">{children}</WorkspaceSplitShell>;
}
