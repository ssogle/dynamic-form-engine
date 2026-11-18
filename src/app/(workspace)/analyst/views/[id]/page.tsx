import { AnalysisViewActionBar } from "@/features/manage-analysis-views";
import { AnalysisViewRenderer } from "@/features/render-analysis-view";

interface AnalystViewDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * 분석가 분석 뷰 문서 편집/검토 캔버스 페이지 (/analyst/views/[id])
 */
export default async function AnalystViewDetailPage({ params }: AnalystViewDetailPageProps) {
  const { id } = await params;

  return (
    <div className="w-full space-y-6">
      <AnalysisViewActionBar viewId={id} />
      <AnalysisViewRenderer viewId={id} />
    </div>
  );
}
