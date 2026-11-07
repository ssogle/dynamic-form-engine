/**
 * 공통 유틸리티 Public API 진입점
 *
 * FSD 원칙에 따라 외부 레이어는 `@/shared/lib/utils`를 통해
 * 클래스명 병합 도구(cn) 등 순수 유틸리티 함수들을 참조합니다.
 */
export { cn } from "./cn.util";
export {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatUtc,
  nowUtcIso,
  toSafeDate,
  toUtcIso,
  type DateInput,
} from "./date.util";
