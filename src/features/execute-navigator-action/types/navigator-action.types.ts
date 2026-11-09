import type { ActiveForm, CoreFormField, Form } from "@/entities/form";

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
  field?: CoreFormField | undefined;
  fields?: CoreFormField[] | undefined;
  title?: string | undefined;
  slug?: string | undefined;
  formId?: string | undefined;
  message?: string | undefined;
}

export interface CreateFormAction {
  type: "CREATE_FORM";
  slug: string;
  title: string;
  description?: string | undefined;
  fields: CoreFormField[];
  message?: string | undefined;
}

export interface PublishFormAction {
  type: "PUBLISH_FORM";
  slug: string;
  isPublished: boolean;
  message?: string | undefined;
}

export interface DeleteFormsAction {
  type: "DELETE_FORMS";
  deletedSlugs: string[];
  message?: string | undefined;
}

export type NavigatorBuilderAction =
  NavigateAction | UpdateSchemaAction | CreateFormAction | PublishFormAction | DeleteFormsAction;

// ==========================================
// 2. 컨슈머 클라이언트 액션 규격 (Consumer Actions)
// ==========================================

export interface FillFieldsAction {
  type: "FILL_FIELDS";
  formSlug?: string | undefined;
  fields: Record<string, unknown>;
  message?: string | undefined;
}

export interface SubmitFormAction {
  type: "SUBMIT_FORM";
  formSlug?: string | undefined;
  message?: string | undefined;
}

export type NavigatorConsumerAction = NavigateAction | FillFieldsAction | SubmitFormAction;

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
 * 네비게이터 실행 요청 컨텍스트
 */
export interface NavigatorClientContext {
  /** 현재 사용자 브라우저 경로 */
  currentPath?: string | undefined;

  // Builder Context
  /** 빌더 화면에서 열려있는 활성 폼 정보 */
  currentForm?:
    | {
        slug: string;
        title: string;
        description?: string | undefined;
        fields: CoreFormField[];
      }
    | undefined;

  // Consumer Context
  /** 컨슈머 화면에서 열려있는 폼 슬러그 */
  currentFormSlug?: string | undefined;
  /** 컨슈머 화면에서 열려있는 폼 제목 */
  currentFormTitle?: string | undefined;
  /** 컨슈머 화면에서 사용 가능한 필드 명세 */
  availableFields?:
    | Array<{
        id?: string | undefined;
        name: string;
        label: string;
        type: string;
        required?: boolean | undefined;
        options?: string[] | undefined;
      }>
    | undefined;
  /** 현재 응답자가 작성 중인 임시 필드값 (draftValues) */
  currentDraftValues?: Record<string, unknown> | undefined;
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
  /** 서버에서 갱신/생성된 폼 데이터 (존재하는 경우) */
  updatedForm?: ActiveForm | Form | null | undefined;
  /** 호환용 메시지 필드 */
  message?: string | undefined;
}
