import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AnalysisViewRenderer } from "@/features/render-analysis-view";
import { Button } from "@/shared/ui/button";

interface ConsumerViewDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * 컨슈머 포털 발행 분석 뷰 읽기 전용 상세 페이지 (/consumer/views/[id])
 *
 * publishedOnly 옵션을 활성화하여 미발행 초안 문서 접근 시 서버 API가 404를 반환하도록 보호합니다.
 */
export default async function ConsumerViewDetailPage({ params }: ConsumerViewDetailPageProps) {
  const { id } = await params;

  return (
    <div className="w-full space-y-6">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground gap-1.5">
        <Link href="/consumer">
          <ArrowLeft className="size-4" />
          목록으로 돌아가기
        </Link>
      </Button>

      <AnalysisViewRenderer viewId={id} publishedOnly />
    </div>
  );
}
