import type { Metadata } from "next";
import { RelationalSubmissionEditor } from "@/widgets/relational-form-picker";

interface ConsumerSubmissionEditPageProps {
  params: Promise<{
    id: string;
    submissionId: string;
  }>;
}

export const metadata: Metadata = {
  title: "응답 수정 - AI Dynamic Form Engine",
  description: "기제출된 동적 폼 응답 데이터를 수정합니다.",
};

/**
 * 컨슈머 폼 응답 수정 페이지 (GET /consumer/forms/[id]/submissions/[submissionId]/edit)
 *
 * App Router 비동기 파라미터 규격을 준수하여 id와 submissionId를 추출하고,
 * 전용 응답 수정 위젯을 렌더링하는 Thin 라우트 페이지입니다.
 */
export default async function ConsumerSubmissionEditPage({
  params,
}: ConsumerSubmissionEditPageProps) {
  const { id, submissionId } = await params;

  return <RelationalSubmissionEditor formId={id} submissionId={submissionId} />;
}
