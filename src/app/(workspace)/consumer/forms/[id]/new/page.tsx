import * as React from "react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { ConsumerFormSubmitter } from "@/features/render-dynamic-form";

interface ConsumerFormNewSubmissionPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * 컨슈머 신규 응답 데이터 작성 페이지 (/consumer/forms/[id]/new)
 *
 * 공식 발행된 활성 폼을 불러와 엔드유저 또는 AI Navigator가 답변을 입력하고 서버로 제출하는 화면입니다.
 * 상단에서 데이터 레코드 목록(/consumer/forms/[id])으로 복귀하는 동선을 제공합니다.
 */
export default async function ConsumerFormNewSubmissionPage({
  params,
}: ConsumerFormNewSubmissionPageProps) {
  const { id } = await params;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground text-xs">
            <Link href={`/consumer/forms/${id}`}>← 데이터 목록으로 돌아가기</Link>
          </Button>
        </div>
      </div>

      <ConsumerFormSubmitter formId={id} />
    </div>
  );
}
