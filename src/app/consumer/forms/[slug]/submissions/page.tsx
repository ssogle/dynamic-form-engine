import * as React from "react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { ConsumerFormSubmissionsView } from "./consumer-form-submissions-view";

interface ConsumerFormSubmissionsPageProps {
  params: Promise<{
    slug: string;
  }>;
}

/**
 * 특정 폼의 제출된 응답 데이터 관리 화면 (/consumer/forms/[slug]/submissions)
 */
export default async function ConsumerFormSubmissionsPage({
  params,
}: ConsumerFormSubmissionsPageProps) {
  const { slug } = await params;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground text-xs">
            <Link href={`/consumer/forms/${slug}`}>← 폼 입력 화면으로</Link>
          </Button>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href="/consumer/forms">폼 목록으로 이동</Link>
        </Button>
      </div>

      <ConsumerFormSubmissionsView slug={slug} />
    </div>
  );
}
