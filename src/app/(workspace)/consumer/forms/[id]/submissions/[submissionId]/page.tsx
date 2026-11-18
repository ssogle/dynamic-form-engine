import * as React from "react";
import type { Metadata } from "next";
import { SubmissionDetailView } from "@/features/manage-form-submissions";

interface ConsumerSubmissionDetailPageProps {
  params: Promise<{
    id: string;
    submissionId: string;
  }>;
}

export const metadata: Metadata = {
  title: "응답 상세 조회 | Dynamic Form Engine",
  description: "등록된 폼 응답의 상세 내용과 메타데이터를 확인합니다.",
};

/**
 * 컨슈머 폼 응답 단건 상세 페이지 (/consumer/forms/[id]/submissions/[submissionId])
 *
 * 부모 폼 스키마 메타데이터와 응답 레코드의 필드별 입력값 및 생성/수정 일시를
 * 구조화된 카드 형태로 상세 조회하고 수정/삭제 액션을 제공하는 라우트입니다.
 */
export default async function ConsumerSubmissionDetailPage({
  params,
}: ConsumerSubmissionDetailPageProps) {
  const { id, submissionId } = await params;

  return <SubmissionDetailView formId={id} submissionId={submissionId} />;
}
