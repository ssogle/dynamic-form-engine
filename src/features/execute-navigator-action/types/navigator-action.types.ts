import type { ActiveForm, CoreFormField, Form, SelectOption } from "@/entities/form";

/**
 * 네비게이터 동작 모드 구분
 */
export type NavigatorMode = "builder" | "consumer";

/**
 * 폼 스키마 변경 오퍼레이션 유형 (Builder 전용)
 */
export type SchemaOperation = "ADD_FIELD" | "UPDATE_FIELD" | "REMOVE_FIELD" | "SET_ALL_FIELDS";

// ==========================================
// 1. 빌더 클라이언트 액션 규격 (Builder Actions)
// ==========================================

export interface NavigateAction {
  type: "NAVIGATE";
  targetPath: string;
  message?: string | undefined;
}

export interface UpdateSchemaAction {
  type: "UPDATE_SCHEMA";
  operation: SchemaOperation;
  formId: string;
  field?: CoreFormField | undefined;
  fields?: CoreFormField[] | undefined;
  title?: string | undefined;
  message?: string | undefined;
}

export interface CreateFormAction {
  type: "CREATE_FORM";
  formId: string;
  title: string;
  description?: string | undefined;
  fields: CoreFormField[];
  message?: string | undefined;
}

export interface PublishFormAction {
  type: "PUBLISH_FORM";
  formId: string;
  isPublished: boolean;
  message?: string | undefined;
}

export interface DeleteFormsAction {
  type: "DELETE_FORMS";
  deletedIds: string[];
  message?: string | undefined;
}

export type NavigatorBuilderAction =
  NavigateAction | UpdateSchemaAction | CreateFormAction | PublishFormAction | DeleteFormsAction;

// ==========================================
// 2. 컨슈머 클라이언트 액션 규격 (Consumer Actions)
// ==========================================

export interface FillFieldsAction {
  type: "FILL_FIELDS";
  formId?: string | undefined;
  fields: Record<string, unknown>;
  message?: string | undefined;
}

export interface SubmitFormAction {
  type: "SUBMIT_FORM";
  formId?: string | undefined;
  message?: string | undefined;
}

export interface DeleteSubmissionsAction {
  type: "DELETE_SUBMISSIONS";
  deletedIds: string[];
  message?: string | undefined;
}

export type NavigatorConsumerAction =
  NavigateAction | FillFieldsAction | SubmitFormAction | DeleteSubmissionsAction;

// ==========================================
// 3. 통합 액션 규격 (Unified Action)
// ==========================================

export type NavigatorAction = NavigatorBuilderAction | NavigatorConsumerAction;

/**
 * 대화 세션 메시지 DTO
 */
export interface NavigatorChatMessageDto {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * 화면 테이블/목록에 렌더링된 항목의 경량 요약 정보 (React Query 캐시 연동)
 */
export interface VisibleItemSummary {
  /** 레코드 고유 ID (UUID) */
  id: string;
  /** 항목 제목 (폼 제목 또는 응답자 요약) */
  title: string;
  /** 생성 일시 (UTC) */
  createdAt?: string | undefined;
  /** 보조 요약 문구 (예: '홍길동 (경력 5년)') */
  summary?: string | undefined;
}

/**
 * 네비게이터 실행 요청 컨텍스트
 */
export interface NavigatorClientContext {
  /** 현재 사용자 브라우저 경로 */
  currentPath?: string | undefined;

  // Builder Context
  /** 빌더 화면에서 열려있는 활성 폼 정보 */
  currentForm?:
    | {
        id: string;
        title: string;
        description?: string | undefined;
        fields: CoreFormField[];
      }
    | undefined;
  /** 빌더 폼 목록 테이블의 렌더링 캐시 목록 */
  visibleForms?: VisibleItemSummary[] | undefined;

  // Consumer Context
  /** 컨슈머 화면에서 열려있는 폼 ID (UUID) */
  currentFormId?: string | undefined;
  /** 컨슈머 화면에서 열려있는 폼 제목 */
  currentFormTitle?: string | undefined;
  /** 컨슈머 화면에서 사용 가능한 필드 명세 */
  availableFields?:
    | Array<{
        id: string;
        label: string;
        type: string;
        required?: boolean | undefined;
        options?: (string | SelectOption)[] | undefined;
      }>
    | undefined;
  /** 현재 응답자가 작성 중인 임시 필드값 (draftValues) */
  currentDraftValues?: Record<string, unknown> | undefined;
  /** 컨슈머 응답 목록 테이블의 렌더링 캐시 목록 */
  visibleSubmissions?: VisibleItemSummary[] | undefined;
}

/**
 * 네비게이터 서버 실행 요청 페이로드
 */
export interface ExecuteNavigatorPayload {
  /** 실행 모드 (기본값: builder) */
  mode?: NavigatorMode | undefined;
  /** 사용자가 입력한 자연어 발화 명령 */
  prompt: string;
  /** 이전 대화 히스토리 (선택) */
  messages?: NavigatorChatMessageDto[] | undefined;
  /** 클라이언트의 현재 UI 화면 컨텍스트 */
  currentContext?: NavigatorClientContext | undefined;
}

/**
 * 네비게이터 서버 실행 응답 규격
 */
export interface NavigatorExecutionResponse {
  /** 사용자에게 표시할 자연어 답변 텍스트 */
  reply: string;
  /** 화면을 제어하기 위해 클라이언트가 수행해야 할 단일 액션 (없는 경우 null) */
  action: NavigatorAction | null;
  /** [신규] 순차 실행할 클라이언트 복합 액션 배열 (예: [NAVIGATE, FILL_FIELDS]) */
  actions?: NavigatorAction[] | undefined;
  /** 서버에서 갱신/생성된 폼 데이터 (존재하는 경우) */
  updatedForm?: ActiveForm | Form | null | undefined;
  /** 호환용 메시지 필드 */
  message?: string | undefined;
}
