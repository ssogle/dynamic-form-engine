import type { ActiveForm, Form, CoreFormField } from "@/entities/form";

/**
 * 동적 폼 렌더러의 동작 모드
 * - "preview": 빌더 화면에서 폼 레이아웃 및 필드 상호작용을 미리 확인하는 모드 (제출 버튼 미노출, 필드 포커스 하이라이트)
 * - "submission": 컨슈머(최종 응답자) 화면에서 실제 응답을 입력하고 서버로 제출하는 모드 (제출 버튼 노출, 제출 액션 트리거)
 */
export type DynamicFormMode = "preview" | "submission";

/**
 * 동적 폼 렌더러 메인 컴포넌트의 Props 인터페이스
 * exactOptionalPropertyTypes 설정 호환을 위해 선택 속성에는 명시적으로 `| undefined`를 유니온으로 허용합니다.
 */
export interface DynamicFormRendererProps {
  /** 렌더링 대상 폼 엔티티 객체 (ActiveForm 또는 Form). 미전달 시 slug를 통해 쿼리로 자동 조회합니다. */
  form?: (ActiveForm | Form | null) | undefined;

  /** 폼 슬러그 또는 UUID (form이 전달되지 않은 경우 쿼리로 자동 조회) */
  slug?: string | undefined;

  /** 동작 모드 (기본값: "submission") */
  mode?: DynamicFormMode | undefined;

  /**
   * 컨슈머 모드: 제출 이벤트 핸들러
   * React Hook Form의 유효성 검사를 통과한 정제 데이터가 전달됩니다.
   */
  onSubmit?: ((data: Record<string, unknown>) => Promise<void> | void) | undefined;

  /**
   * 외부 또는 AI Navigator로부터 주입되는 제어 입력값 맵
   */
  values?: Record<string, unknown> | undefined;

  /**
   * AI Navigator 등 외부에서 제출을 프로그래밍 방식으로 트리거하기 위한 증분 카운터
   */
  submitTriggerCount?: number | undefined;

  /**
   * 프리뷰 모드: 현재 AI 네비게이터 또는 사용자가 선택/집중하고 있는 필드 ID
   */
  selectedFieldId?: string | undefined;

  /**
   * 프리뷰 모드: 필드 클릭 핸들러 (네비게이터 대화 패널과 컨텍스트 연동)
   */
  onFieldClick?: ((fieldId: string) => void) | undefined;

  /**
   * 서버 제출 진행 중 여부 (로딩 스피너 및 폼 비활성화)
   */
  isSubmitting?: boolean | undefined;

  /**
   * 폼 전체 비활성화 여부
   */
  disabled?: boolean | undefined;

  /**
   * 외부 커스텀 스타일 클래스
   */
  className?: string | undefined;
}

/**
 * 개별 동적 필드 컴포넌트 Props 인터페이스
 */
export interface DynamicFieldProps {
  /** 코어 폼 필드 정의 메타데이터 */
  field: CoreFormField;

  /** 현재 필드가 선택되었는지 여부 */
  isSelected?: boolean | undefined;

  /** 필드 클릭 핸들러 */
  onFieldClick?: ((fieldId: string) => void) | undefined;

  /** 필드 유효성 검사 에러 메시지 */
  error?: string | undefined;

  /** 비활성화 여부 */
  disabled?: boolean | undefined;
}
