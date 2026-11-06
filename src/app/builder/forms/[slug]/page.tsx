import * as React from "react";
import Link from "next/link";
import { FormPreviewCanvas } from "@/features/preview-dynamic-form";
import { Button } from "@/shared/ui/button";

/**
 * 빌더 내부 폼 라이브 캔버스 페이지 프로퍼티
 *
 * Next.js 16.4.4 규격에 따라 params는 Promise 타입으로 선언합니다.
 */
interface BuilderFormSlugPageProps {
  params: Promise<{
    slug: string;
  }>;
}

/**
 * 실시간 동적 폼 라이브 캔버스 (/builder/forms/[slug])
 *
 * 좌측 AI Navigator와의 실시간 대화 명령에 따라 폼 스키마가 결정론적으로 실시간 갱신되는 뷰어입니다.
 */
export default async function BuilderFormSlugPage({ params }: BuilderFormSlugPageProps) {
  const { slug } = await params;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            실시간 폼 라이브 캔버스
          </h1>
          <p className="text-muted-foreground text-xs">
            URL 식별자: <span className="text-primary font-mono font-medium">{slug}</span>
          </p>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href="/builder/forms">폼 목록으로 돌아가기</Link>
        </Button>
      </div>

      <FormPreviewCanvas slug={slug} />
    </div>
  );
}
