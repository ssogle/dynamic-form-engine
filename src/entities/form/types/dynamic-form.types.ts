/**
 * 동적 유효성 검증 엔진의 반환 결과 인터페이스
 */
export interface SubmissionValidationResult {
  /** 전체 유효성 검사 통과 여부 */
  isValid: boolean;

  /** 필드명(또는 ID)을 Key로 하고 에러 메시지를 Value로 갖는 에러 맵 */
  errors: Record<string, string>;

  /** 정제 및 타입 변환(예: 문자열 -> 숫자)이 완료된 데이터 (성공 시에만 유효) */
  cleanedData?: Record<string, unknown> | undefined;
}
