import { redirect } from "next/navigation";

/**
 * 빌더 메인 진입점
 *
 * 빌더의 기본 작업 공간인 폼 목록 화면(/builder/forms)으로 즉시 리다이렉트합니다.
 */
export default function BuilderRootPage() {
  redirect("/builder/forms");
}
