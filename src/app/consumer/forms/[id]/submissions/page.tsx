import * as React from "react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { ManageFormSubmissions } from "@/features/manage-form-submissions";

interface ConsumerFormSubmissionsPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * 특정 폼의 제출된 응답 데이터 관리 화면 (/consumer/forms/[id]/submissions)
 *
 * App Router 비동기 파라미터 규격을 준수하여 id를 추출하고
 * 응답 목록 열람 및 삭제 기능을 수행하는 피처 컴포넌트를 조립하는 Thin 라우트 페이지입니다.
 */
export default async function ConsumerFormSubmissionsPage({
  params,
}: ConsumerFormSubmissionsPageProps) {
  const { id } = await params;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground text-xs">
            <Link href={`/consumer/forms/${id}`}>← 폼 입력 화면으로</Link>
          </Button>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href="/consumer/forms">폼 목록으로 이동</Link>
        </Button>
      </div>

      <ManageFormSubmissions formId={id} />
    </div>
  );
}
