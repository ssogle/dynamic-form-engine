import { AnalysisViewRenderer } from "@/features/render-analysis-view";
import { BackLink } from "@/shared/ui/back-link";

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <BackLink href="/consumer" label="포털 목록으로" />
      </div>

      <AnalysisViewRenderer viewId={id} publishedOnly />
    </div>
  );
}
