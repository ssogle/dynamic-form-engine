import { PublishedAnalysisViewList } from "@/features/manage-analysis-views";

/**
 * 컨슈머 내부 공유 뷰 목록 화면 (/consumer/views)
 *
 * 분석가가 공식 발행한 분석 뷰 문서 목록을 읽기 전용으로 열람합니다.
 */
export default function ConsumerViewsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">공유된 뷰 목록</h1>
        <p className="text-muted-foreground text-sm/relaxed">
          수집된 폼 응답 데이터를 바탕으로 분석가가 공식 발행한 분석 리포트 및 시각화 뷰 목록입니다.
        </p>
      </div>

      <PublishedAnalysisViewList />
    </div>
  );
}
