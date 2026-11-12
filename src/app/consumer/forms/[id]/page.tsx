import * as React from "react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { ManageFormSubmissions } from "@/features/manage-form-submissions";

interface ConsumerFormIdPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * 컨슈머 데이터 도메인 레코드 목록 관리 페이지 (/consumer/forms/[id])
 *
 * 공식 발행된 활성 폼의 제출 데이터를 조회/검색/정렬하는 기본 메인 뷰포트입니다.
 * 상단에서 신규 데이터 작성(/new) 및 전체 폼 목록 탐색 링크를 제공합니다.
 */
export default async function ConsumerFormIdPage({ params }: ConsumerFormIdPageProps) {
  const { id } = await params;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground text-xs">
            <Link href="/consumer/forms">폼 목록으로 돌아가기</Link>
          </Button>
        </div>

        <Button asChild size="sm">
          <Link href={`/consumer/forms/${id}/new`}>신규 데이터 작성</Link>
        </Button>
      </div>

      <ManageFormSubmissions formId={id} />
    </div>
  );
}
