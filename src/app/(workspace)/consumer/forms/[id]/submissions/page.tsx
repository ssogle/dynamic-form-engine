import { redirect } from "next/navigation";

interface ConsumerFormSubmissionsPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * 특정 폼의 제출된 응답 데이터 관리 화면 (/consumer/forms/[id]/submissions)
 *
 * Spec-004 라우팅 개편에 따라 메인 진입점이 /consumer/forms/[id]로 승격되었으므로,
 * 하위 호환성을 위해 /consumer/forms/[id]로 즉시 리다이렉트합니다.
 */
export default async function ConsumerFormSubmissionsPage({
  params,
}: ConsumerFormSubmissionsPageProps) {
  const { id } = await params;
  redirect(`/consumer/forms/${id}`);
}
