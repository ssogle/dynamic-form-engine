/**
 * 날짜 및 시간 처리 Public API 진입점
 *
 * FSD(Feature-Sliced Design) 아키텍처 원칙에 따라 외부 레이어는
 * `@/shared/lib/date`를 통해 안전한 날짜 포맷팅 및 UTC 직렬화 함수를 참조합니다.
 */
export {
  formatDate,
  formatDateTime,
  formatDateToYmd,
  formatRelativeTime,
  formatUtc,
  nowUtcIso,
  parseYmdToDate,
  toSafeDate,
  todayYmd,
  toUtcIso,
  type DateInput,
} from "./date";
