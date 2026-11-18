import type { ReactNode } from "react";
import { WorkspaceSplitShell } from "../_components/workspace-split-shell";

/**
 * 분석가(Analyst Knowledge Studio) 대칭 작업 공간 레이아웃
 *
 * 최상위 WorkspaceLayout의 글로벌 앱 바 하단 영역(h-full)을 채우며,
 * 좌측 Analyst AI Navigator 패널과 우측 분석 뷰 캔버스를 렌더링합니다.
 */
export default function AnalystLayout({ children }: { readonly children: ReactNode }) {
  return <WorkspaceSplitShell mode="analyst">{children}</WorkspaceSplitShell>;
}
