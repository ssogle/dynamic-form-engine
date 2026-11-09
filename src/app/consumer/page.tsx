import { redirect } from "next/navigation";

/**
 * 컨슈머 루트 진입점 (/consumer)
 *
 * 일관된 탐색 흐름을 위해 즉시 참여 가능한 폼 목록(/consumer/forms)으로 리다이렉트합니다.
 */
export default function ConsumerRootPage() {
  redirect("/consumer/forms");
}
