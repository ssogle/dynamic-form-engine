import { PublishedFormList } from "@/features/browse-published-forms";
import { PublishedAnalysisViewList } from "@/features/manage-analysis-views";
import { Separator } from "@/shared/ui/separator";

/**
 * 컨슈머 통합 포털 메인 화면 (/consumer)
 *
 * 빌더가 공식 발행한 참여 가능 폼 목록과 분석가가 공유한 분석 뷰 문서 목록을
 * 단일 화면에서 함께 탐색할 수 있도록 제공합니다.
 */
export default function ConsumerPortalPage() {
  return (
    <div className="w-full space-y-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">컨슈머 포털</h1>
        <p className="text-muted-foreground text-sm/relaxed">
          공식 발행된 폼과 분석가가 공유한 리포트 뷰를 한곳에서 확인할 수 있습니다. 원하는 항목을
          선택하거나 좌측 AI Navigator에게 필요한 작업을 말씀해 보세요.
        </p>
      </div>

      {/* 1. 빌더가 발행한 데이터 도메인 폼 섹션 */}
      <section id="forms" aria-labelledby="consumer-forms-heading" className="space-y-4">
        <div className="space-y-1">
          <h2
            id="consumer-forms-heading"
            className="text-foreground text-lg font-semibold tracking-tight"
          >
            이용 가능한 데이터 폼
          </h2>
          <p className="text-muted-foreground text-xs/relaxed">
            카드를 선택해 등록된 데이터를 조회·검색하거나 새로운 레코드를 작성할 수 있습니다.
          </p>
        </div>
        <PublishedFormList />
      </section>

      <Separator />

      {/* 2. 분석가가 공유한 분석 뷰 섹션 */}
      <section id="views" aria-labelledby="consumer-views-heading" className="space-y-4">
        <div className="space-y-1">
          <h2
            id="consumer-views-heading"
            className="text-foreground text-lg font-semibold tracking-tight"
          >
            공유된 분석 뷰
          </h2>
          <p className="text-muted-foreground text-xs/relaxed">
            수집된 응답 데이터를 바탕으로 분석가가 공식 발행한 리포트 문서입니다.
          </p>
        </div>
        <PublishedAnalysisViewList />
      </section>
    </div>
  );
}
