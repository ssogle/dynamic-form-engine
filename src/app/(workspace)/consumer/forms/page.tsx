import { redirect } from "next/navigation";

/**
 * 구 컨슈머 폼 목록 경로 (/consumer/forms)
 *
 * 폼 목록과 공유 뷰 목록이 통합된 컨슈머 포털(/consumer)로 리다이렉트하여 하위 호환성을 유지합니다.
 */
export default function ConsumerFormsRedirectPage() {
  redirect("/consumer#forms");
}
