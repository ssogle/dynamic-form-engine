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

/**
 * 정형 인라인 선택지(select, radio, checkbox) 옵션 인터페이스
 */
export interface SelectOption {
  /** 화면에 표시되는 옵션 라벨 (예: "신규 개발") */
  label: string;

  /** DB에 실제 저장되는 불변 코드값 (예: "new_dev") */
  value: string;

  /** 옵션 선택 기준 및 상세 업무 규칙을 안내하는 필수 설명 */
  description: string;

  /** 소프트 비활성화 여부 (과거 라벨 보존 및 신규 선택 차단) */
  disabled?: boolean | undefined;
}

/**
 * 관계형 필드(relation) 설정 메타데이터 인터페이스
 */
export interface RelationConfig {
  /** 참조 대상 도메인 폼 UUID */
  targetFormId: string;

  /** 다중 선택(N:M) 여부 (기본값: false - 단일 선택) */
  multiple?: boolean | undefined;
}
