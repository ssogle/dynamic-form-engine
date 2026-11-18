import { redirect } from "next/navigation";

/**
 * 분석가 작업 공간 루트 엔트리 (/analyst)
 * 기본적으로 분석 뷰 문서 목록(/analyst/views)으로 리다이렉트합니다.
 */
export default function AnalystRootPage() {
  redirect("/analyst/views");
}
