import type { AnalysisBlock, AnalysisView } from "@/entities/analysis-view";
import type { ActiveForm, CoreFormField, Form } from "@/entities/form";
import type {
  ExecuteNavigatorPayload,
  NavigatorChatMessageDto,
  NavigatorClientContext,
  NavigatorMode,
  VisibleItemSummary,
} from "../schema/navigator-request.schema";
import {
  ANALYSIS_VIEW_OPERATIONS,
  SCHEMA_OPERATIONS,
  type AnalysisViewOperation,
  type SchemaOperation,
} from "../schema/navigator-tools.schema";

export {
  ANALYSIS_VIEW_OPERATIONS,
  SCHEMA_OPERATIONS,
  type AnalysisViewOperation,
  type ExecuteNavigatorPayload,
  type NavigatorChatMessageDto,
  type NavigatorClientContext,
  type NavigatorMode,
  type SchemaOperation,
  type VisibleItemSummary,
};

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
  primaryFieldId?: string | undefined;
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
  primaryFieldId?: string | undefined;
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
// 3. 분석가 클라이언트 액션 규격 (Analyst Actions)
// ==========================================

export interface CreateAnalysisViewAction {
  type: "CREATE_ANALYSIS_VIEW";
  viewId: string;
  title: string;
  description?: string | undefined;
  blocks: AnalysisBlock[];
  message?: string | undefined;
}

export interface UpdateAnalysisViewAction {
  type: "UPDATE_ANALYSIS_VIEW";
  operation: AnalysisViewOperation;
  viewId: string;
  title?: string | undefined;
  description?: string | undefined;
  blocks: AnalysisBlock[];
  message?: string | undefined;
}

export interface PublishAnalysisViewAction {
  type: "PUBLISH_ANALYSIS_VIEW";
  viewId: string;
  isPublished: boolean;
  message?: string | undefined;
}

export interface DeleteAnalysisViewsAction {
  type: "DELETE_ANALYSIS_VIEWS";
  deletedIds: string[];
  message?: string | undefined;
}

export type NavigatorAnalystAction =
  | NavigateAction
  | CreateAnalysisViewAction
  | UpdateAnalysisViewAction
  | PublishAnalysisViewAction
  | DeleteAnalysisViewsAction;

// ==========================================
// 4. 통합 액션 규격 (Unified Action)
// ==========================================

export type NavigatorAction =
  NavigatorBuilderAction | NavigatorConsumerAction | NavigatorAnalystAction;

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
  /** 서버에서 갱신/생성된 분석 뷰 문서 데이터 (존재하는 경우) */
  updatedAnalysisView?: AnalysisView | null | undefined;
  /** 호환용 메시지 필드 */
  message?: string | undefined;
}

/**
 * 네비게이터 NDJSON 스트림 이벤트 계약 (서버-클라이언트 단일 진실 원천)
 *
 * - `status`: 실제 AI 엔진 작업 단계 진행 메시지 (채팅 기록 누적 대상)
 * - `heartbeat`: 장시간 LLM 대기 중 스트림 침묵 방지용 경과 알림 (채팅 기록 제외)
 * - `result`: 최종 실행 결과 응답
 * - `error`: 스트림 열린 이후 발생한 오류 메시지
 */
export type NavigatorStreamEvent =
  | { type: "status"; message: string }
  | { type: "heartbeat"; message: string }
  | { type: "result"; data: NavigatorExecutionResponse }
  | { type: "error"; message: string };
