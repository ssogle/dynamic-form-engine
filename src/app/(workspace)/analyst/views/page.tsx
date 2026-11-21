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
          AI Analyst Navigator에게 자연어로 질문하면 발행된 폼과 누적 응답 데이터를 분석해
          차트·표·요약 블록이 포함된 분석 뷰를 생성하거나 수정할 수 있습니다.
        </p>
      </div>

      <AnalysisViewList />
    </div>
  );
}
