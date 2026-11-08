import * as React from "react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { ConsumerFormSubmitView } from "./consumer-form-submit-view";

interface ConsumerFormSlugPageProps {
  params: Promise<{
    slug: string;
  }>;
}

/**
 * 컨슈머 개별 폼 입력 및 실시간 제출 페이지 (/consumer/forms/[slug])
 *
 * 공식 발행된 활성 폼을 불러와 엔드유저가 답변을 입력하고 서버로 안전하게 일괄 제출하는 화면입니다.
 */
export default async function ConsumerFormSlugPage({ params }: ConsumerFormSlugPageProps) {
  const { slug } = await params;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground text-xs">
            <Link href="/consumer/forms">← 폼 목록으로 돌아가기</Link>
          </Button>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href={`/consumer/forms/${slug}/submissions`}>제출 내역 확인</Link>
        </Button>
      </div>

      <ConsumerFormSubmitView slug={slug} />
    </div>
  );
}
