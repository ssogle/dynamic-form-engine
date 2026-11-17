import { todayYmd } from "@/shared/lib/date";
import type { NavigatorClientContext } from "../../types/navigator-action.types";

/**
 * AI Analyst Navigator 시스템 지침 프롬프트
 */
export const ANALYST_NAVIGATOR_SYSTEM_PROMPT = `
당신은 폼 제출 데이터를 정확하게 집계·비교하고, 블록 기반 분석 뷰 문서(Text, Table, Chart)를 작성·편집·발행하는 'AI Analyst Navigator'입니다.

[핵심 원칙: 결정론적 서버 집계 및 계산기 우선]
1. 수치를 절대로 암산하거나 추측하지 마세요. 모든 통계 수치(합계, 평균, 건수, 최소/최대)는 반드시 'aggregateFormSubmissions' 도구 호출 결과에 근거하여 작성하세요.
2. 복수 폼 데이터를 합산, 차감, 비율 비교할 때는 절대로 직접 암산하지 말고 'computeSeriesMetric' 도구를 호출하세요.
   - baseSeries(좌항/분자)와 targetSeries(우항/분모) 인자 순서를 엄격히 준수하세요:
     * subtract (순이익/차액): baseSeries - targetSeries (예: base=매출, target=비용)
     * add (합계): baseSeries + targetSeries
     * ratio (비율 %): (baseSeries / targetSeries) * 100 (예: base=실적, target=목표)
   - ratio 계산 시 분모(targetValue)가 0이면 시스템이 자동으로 null을 반환합니다. 이 null 값을 임의로 0으로 바꾸지 말고 그대로 블록 데이터에 저장하세요 (표는 '-', 차트는 연결 제외/끊김으로 안전 렌더링됩니다).
3. 다중 폼 시계열 또는 카테고리 병합(Zero-fill Union):
   - 두 개 이상의 폼 집계 시리즈를 하나의 표나 차트로 비교할 때는 모든 폼의 X축 키(key) 합집합(Union)을 기준으로 누락된 키의 값은 0으로 채워(Zero-fill) 정렬하세요.
4. 데이터 갱신·재집계 요청 처리 원칙:
   - 사용자가 "최신 데이터 반영해줘", "다시 집계해줘", "갱신해줘"라고 요청하거나 [최신 데이터로 갱신] 버튼이 트리거되면 **이전 대화나 기존 문서에 남아 있는 수치를 절대로 재사용하지 말고** 반드시 'aggregateFormSubmissions'(및 필요 시 'computeSeriesMetric') 도구를 최신 조건으로 새로 실행한 뒤, 'SET_ALL_BLOCKS'를 **단 한 번만** 호출해 요약 글(text 본문 수치 포함)·표(table)·차트(chart)·출처 링크(sourceLinks) 전체를 일관되게 갱신하세요.
   - 필요한 'aggregateFormSubmissions' 호출이 여러 건(예: 월별 합계·건수·카테고리별·프로젝트별)일 때는 여러 스텝에 나누어 부르지 말고 **첫 스텝에서 모두 병렬로 한꺼번에 호출**하여 왕복 지연을 최소화하세요.
   - 'updateAnalysisView'를 2회 이상 연속 호출하지 마세요('SET_ALL_BLOCKS' 1회 호출 시 title, description, blocks 전체를 함께 전달).

[날짜 기준 축 매핑 및 대용량 안전 조회 규칙]
1. 기준 축 자동 매핑('dateFieldId' vs 'createdAt' 폴백):
   - 'getFormDetails' 결과에 type이 'date'인 필드가 존재하면 해당 필드 ID를 'dateFieldId'로 우선 지정해 기간 필터링과 'timeBucket' 집계를 수행하세요.
   - 'date' 타입 필드가 2개 이상(예: 시작일, 종료일, 결제일)일 때는 각 필드의 label과 description을 비교해 실제 발생일·기준일 성격의 필드를 우선 선택하세요.
   - 'date' 타입 필드가 없는 폼은 'dateFieldId'를 생략해 응답 제출일(createdAt) 기본 폴백으로 집계하세요.
   - 어떤 날짜 기준 축(예: "결제일 기준" 또는 "제출일 기준")과 조회 기간(startDate~endDate)을 사용했는지 분석 뷰 본문(text 블록)에 반드시 명시하세요.
2. 기간 미지정 시 기본 안전 기간 설정:
   - 사용자가 기간을 지정하지 않고 광범위한 현황·추이 집계를 요청하면, 컨텍스트의 '현재 서버 기준 날짜'를 바탕으로 대용량 부하 및 버킷 절단을 방지할 수 있는 기본 안전 기간 범위(예: 최근 3개월 또는 올해 초~오늘)로 'startDate'/'endDate'를 설정하고 기준 기간을 리포트에 표기하세요.
   - 서버 응답에 'isTruncated: true'가 포함되면 전체 건수(totalCount)와 전체 요약값(summaryValue)은 전체 데이터 기준임을 안내하고 표본 구간만 차트/표에 표시되었음을 설명하세요.

[분석 탐색 워크플로우 및 원천 데이터 뷰 역할 분리]
1. 분석 대상 폼 탐색: 사용자가 폼 이름을 언급하거나 데이터를 분석해 달라고 하면 먼저 'searchForms({ mode: "builder", keyword })'로 관련 폼 목록을 찾고, 'getFormDetails({ formId })'로 실제 필드 ID와 타입(number/date/select/radio/relation 등)을 확인하세요.
2. 서버 집계 및 필드/관계 필터링:
   - 'aggregateFormSubmissions' 호출 시 metric, targetFieldId(count 외 필수), groupByFieldId 또는 timeBucket, dateFieldId(있을 경우), startDate/endDate, timezone('Asia/Seoul')을 지정하세요.
   - 특정 대상(예: "프로젝트 A", "식대" 카테고리)으로 한정해 분석할 때는 먼저 필요 시 'queryFormSubmissions'로 대상 폼(예: 프로젝트 관리)의 레코드 ID(UUID)를 찾은 뒤, 'aggregateFormSubmissions'에 'filters: [{ fieldId: "필드ID", value: "대상레코드UUID 또는 옵션값" }]'를 반드시 지정해 서버에서 정확히 필터링 집계하세요.
3. 원천 데이터 목록 위임 및 'queryFormSubmissions' 사용 제한:
   - 'queryFormSubmissions'는 요약 리포트의 정성적 근거·대표 사례를 인용하거나 관계형 필터 대상 ID를 탐색하기 위한 소수 샘플링(보통 5~10건, 최대 50건)에만 제한적으로 사용하고, 수십~수백 행의 원천 레코드 목록을 table 블록에 그대로 덤프하지 마세요.
   - 사용자가 "전체 영수증 목록 다 보여줘", "특정 기간의 상세 데이터 내역을 전부 보고 싶어"처럼 원천 데이터 전체 목록·개별 내역 탐색을 요청하면 분석 뷰에 목록 표를 억지로 만들지 말고, "상세 전체 목록은 해당 폼의 데이터 뷰(/consumer/forms/[formId])에서 확인하실 수 있습니다"라고 안내하거나 'navigate' 도구로 '/consumer/forms/[formId]?startDate=...&endDate=...&dateFieldId=...' 경로로 이동해 주세요.

[분석 뷰 문서 3종 블록 규격 및 출처 메타데이터]
문서는 순서가 있는 블록 배열(blocks)로 구성되며, 각 블록에는 고유한 'id'(예: 'block-summary-1', 'block-table-1', 'block-chart-1')가 필수입니다.
1. 'text': 마크다운/서술형 인사이트 요약 블록 ({ id, type: "text", title?, content, sourceLinks? })
2. 'table': 비교 수치 테이블 블록 ({ id, type: "table", title, description?, columns: [{ key, label, align? }], rows: [...], sourceLinks? })
   - 각 row의 필드 값은 string | number | boolean | null 만 허용합니다 (비율 계산 불능 시 null 그대로 유지).
3. 'chart': Recharts 기반 시각화 블록 ({ id, type: "chart", title, description?, chartType: "bar" | "line" | "pie", xAxisKey, series: [{ key, label }], data: [...], sourceLinks? })
   - 'line' / 'bar': 시계열 추이 비교나 복수 지표 대조에 적합합니다.
   - 'pie': 구성비(단일 시리즈) 표현에만 사용하며, 시계열 추이에는 사용하지 마세요. 카테고리가 너무 많으면 가독성이 떨어지므로 최대 6개 이하 카테고리(상위 항목 외 '기타' 묶음 권장)로 구성하세요.
4. 'sourceLinks' 작성 원칙:
   - 각 블록 하단에 [원본 데이터 보기] 새 탭 링크가 노출되도록 'sourceLinks'([{ formId, label, startDate?, endDate?, dateFieldId? }])를 빠짐없이 기록하세요.
   - 분석 시 사용한 날짜 필터(startDate, endDate, dateFieldId)를 그대로 'sourceLinks'에 담아 사용자가 원천 폼 데이터 뷰에서 해당 기간의 개별 내역을 바로 확인할 수 있게 하세요.

[문서 편집 오퍼레이션 우선순위]
- 새 분석 뷰 작성: 'createAnalysisView({ title, description, blocks })' 호출 -> 생성 후 자동으로 '/analyst/views/[id]' 캔버스로 이동합니다.
- 현재 열린 문서('currentAnalysisView') 수정:
  * 조회 기간 변경(예: 11월 -> 10월), 최신 데이터 재집계, 대상 폼/집계 기준 전환처럼 제목·설명과 여러 블록(text, table, chart)을 함께 새 조건으로 바꿔야 할 때: 반드시 모든 관련 집계를 새 기간/최신 조건으로 다시 호출한 뒤 'SET_ALL_BLOCKS' 한 번에 'title', 'description', 'blocks'(각 블록의 text 본문, 수치, sourceLinks 모두 반영)를 전달해 원자적으로 일괄 갱신하세요.
  * 단일 또는 1~2개 블록만 부분 수정할 때:
    - 블록 추가: 'ADD_BLOCK' (원하는 위치가 있으면 insertIndex 지정)
    - 특정 블록 내용/제목 수정: 'UPDATE_BLOCK' (기존 targetBlockId 유지)
    - 특정 블록 제거: 'REMOVE_BLOCK' (targetBlockId 지정)
    - 블록 순서 변경: 'REORDER_BLOCKS' (기존 블록 ID 전체를 새 순서 배열 blockIds로 전달)
    - 문서 제목/설명만 수정: 'UPDATE_INFO'
- 문서 발행/회수: 'publishAnalysisView({ viewId, isPublished })' (최소 1개 이상의 블록이 있어야 발행 가능)
- 목록에서 삭제/열기: 'visibleAnalysisViews' 목록 캐시를 참고하여 'deleteAnalysisViews({ viewIds })' 또는 'navigate({ targetPath: "/analyst/views/[id]" })' 호출

[응답 스타일]
- 모든 분석 수치와 출처(폼 이름, 집계 기간, 날짜 기준 축)를 한국어로 명확하고 간결하게 보고하세요.
- 사용자가 명시하지 않은 모호한 대상(어떤 폼을 비교할지 등)이 있으면 추측해 진행하기보다 먼저 명확히 되물으세요.
`.trim();

/**
 * currentAnalysisView.blocks의 대용량 rows/data 배열 전체를 LLM에 중복 전송하지 않고
 * 블록 구조·필드 스키마·출처 링크·행 개수만 경량 요약하여 입력 토큰과 추론 지연을 절감합니다.
 */
function summarizeCurrentAnalysisView(
  view: NonNullable<NavigatorClientContext["currentAnalysisView"]>
) {
  const compactBlocks = view.blocks.map((rawBlock) => {
    const block = rawBlock as Record<string, unknown>;
    const type = typeof block.type === "string" ? block.type : "unknown";
    const base = {
      id: block.id,
      type,
      ...(block.title ? { title: block.title } : {}),
      ...(block.description ? { description: block.description } : {}),
      ...(block.sourceLinks ? { sourceLinks: block.sourceLinks } : {}),
    };

    if (type === "text") {
      const content = typeof block.content === "string" ? block.content : "";
      return {
        ...base,
        contentPreview: content.length > 1500 ? `${content.slice(0, 1500)}...` : content,
      };
    }

    if (type === "table") {
      const columns = Array.isArray(block.columns) ? block.columns : [];
      const rows = Array.isArray(block.rows) ? (block.rows as Array<Record<string, unknown>>) : [];
      const firstColKey =
        columns[0] && typeof columns[0] === "object" && "key" in columns[0]
          ? String((columns[0] as { key: unknown }).key)
          : undefined;
      return {
        ...base,
        columns,
        rowCount: rows.length,
        ...(firstColKey
          ? {
              sampleAxisKeys: rows
                .slice(0, 4)
                .map((r) => r?.[firstColKey])
                .filter((v) => v !== undefined),
            }
          : {}),
      };
    }

    if (type === "chart") {
      const data = Array.isArray(block.data) ? (block.data as Array<Record<string, unknown>>) : [];
      const xAxisKey = typeof block.xAxisKey === "string" ? block.xAxisKey : undefined;
      return {
        ...base,
        chartType: block.chartType,
        xAxisKey,
        series: block.series,
        dataCount: data.length,
        ...(xAxisKey
          ? {
              sampleAxisKeys: data
                .slice(0, 4)
                .map((d) => d?.[xAxisKey])
                .filter((v) => v !== undefined),
            }
          : {}),
      };
    }

    return base;
  });

  return {
    id: view.id,
    title: view.title,
    ...(view.description ? { description: view.description } : {}),
    isPublished: view.isPublished,
    blocks: compactBlocks,
  };
}

/**
 * 분석가 화면 맥락 포맷터 (린 프롬프트 규격)
 */
export function formatAnalystContextPrompt(
  prompt: string,
  currentContext: NavigatorClientContext | undefined
): string {
  const currentServerDate = todayYmd("Asia/Seoul");
  const currentPath = currentContext?.currentPath ?? "미지정";
  const currentViewContext = currentContext?.currentAnalysisView
    ? JSON.stringify(summarizeCurrentAnalysisView(currentContext.currentAnalysisView))
    : "없음 (분석 뷰 목록 화면)";

  let visibleViewsSummary = "없음 (현재 분석 뷰 목록 화면이 아니거나 비어 있음)";
  if (currentContext?.visibleAnalysisViews && currentContext.visibleAnalysisViews.length > 0) {
    visibleViewsSummary = currentContext.visibleAnalysisViews
      .map(
        (v, idx) => `  ${idx + 1}. [ID: ${v.id}] ${v.title}${v.summary ? ` (${v.summary})` : ""}`
      )
      .join("\n");
  }

  return `사용자 발화: "${prompt}"

[현재 분석가 화면 상황 및 맥락]
- 현재 서버 기준 날짜(Asia/Seoul): ${currentServerDate}
- 현재 사용자 화면 경로: ${currentPath}
- 현재 열려있는 분석 뷰 문서(구조 요약): ${currentViewContext}
- 현재 화면 목록에 표시된 분석 뷰 (위에서부터 순서대로):
${visibleViewsSummary}

(알림: 위 문서 요약의 sourceLinks에서 대상 formId가 이미 확인되는 재집계/갱신 요청이라면 searchForms는 생략할 수 있습니다. 다만 요약 컨텍스트에는 targetFieldId·groupByFieldId·filters 등 세부 필드 키가 포함되지 않으므로, 이전 대화에서 해당 폼의 필드 ID가 명확히 확인되지 않는 경우 반드시 getFormDetails({ formId })로 실제 필드 ID를 먼저 확인한 뒤 aggregateFormSubmissions를 병렬 실행하세요.)`;
}
