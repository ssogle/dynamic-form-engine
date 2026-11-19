import * as React from "react";
import Link from "next/link";
import { DynamicFormRenderer } from "@/features/render-dynamic-form";
import { BuilderDataPreviewDialog } from "@/widgets/builder-form-preview";
import { Button } from "@/shared/ui/button";

/**
 * 빌더 내부 폼 라이브 캔버스 페이지 프로퍼티
 *
 * Next.js 16.4.4 규격에 따라 params는 Promise 타입으로 선언합니다.
 */
interface BuilderFormIdPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * 실시간 동적 폼 라이브 캔버스 (/builder/forms/[id])
 *
 * 좌측 AI Navigator와의 실시간 대화 명령에 따라 폼 스키마가 결정론적으로 실시간 갱신되는 뷰어입니다.
 * 상단 우측 `목록 미리보기` / `상세 미리보기` 모달을 통해 데이터 목록 테이블과 단건 응답 상세 구성을 각각 검수할 수 있습니다.
 */
export default async function BuilderFormIdPage({ params }: BuilderFormIdPageProps) {
  const { id } = await params;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            실시간 폼 라이브 캔버스
          </h1>
          <p className="text-muted-foreground text-xs">
            폼 ID: <span className="text-primary font-mono font-medium">{id}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <BuilderDataPreviewDialog formId={id} />
          <Button asChild variant="outline" size="sm">
            <Link href="/builder/forms">폼 목록으로 돌아가기</Link>
          </Button>
        </div>
      </div>

      <DynamicFormRenderer formId={id} mode="preview" />
    </div>
  );
}
