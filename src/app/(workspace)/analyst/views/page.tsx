import { AnalysisViewList } from "@/features/manage-analysis-views";

/**
 * 분석가 분석 뷰 문서 목록 페이지 (/analyst/views)
 */
export default function AnalystViewsPage() {
  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">분석 뷰 문서 목록</h1>
        <p className="text-muted-foreground text-sm">
          AI Analyst Navigator와 함께 폼 데이터를 비교·집계하여 작성한 분석 뷰 문서입니다.
        </p>
      </div>

      <AnalysisViewList />
    </div>
  );
}
