import type { ActiveForm } from "@/entities/form";
import type {
  CreateFormAction,
  NavigateAction,
  NavigatorAction,
  PublishFormAction,
  UpdateSchemaAction,
} from "../schema/action.schema";

export type {
  CreateFormAction,
  NavigateAction,
  NavigatorAction,
  PublishFormAction,
  UpdateSchemaAction,
};

/**
 * Result 패턴 표준 규격
 */
export type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: { code: string; message: string; details?: unknown } };

/**
 * 이전 대화 히스토리 메시지 규격
 */
export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * AI Navigator 실행 요청 페이로드
 */
export interface ExecuteNavigatorActionPayload {
  /**
   * 사용자 자연어 발화 프롬프트
   */
  prompt: string;

  /**
   * 이전 대화 세션 히스토리 목록 (맥락 유지용)
   */
  messages?: ChatHistoryMessage[] | undefined;

  /**
   * 클라이언트의 현재 화면 컨텍스트
   */
  currentContext?:
    | {
        currentPath?: string | undefined;
        currentForm?: ActiveForm | undefined;
      }
    | undefined;
}

/**
 * AI Navigator 실행 최종 응답 규격
 */
export interface NavigatorExecutionResponse {
  /**
   * 사용자에게 대화창을 통해 전달할 AI 최종 답변 메시지
   */
  reply: string;

  /**
   * 도출 및 수행된 UI 액션 (화면 이동, 폼 생성, 스키마 변경 등 화면 제어가 필요할 때 제공)
   */
  action?: NavigatorAction | null | undefined;

  /**
   * 액션 수행 결과 갱신/생성된 폼 스키마 (해당되는 경우)
   */
  updatedForm?: ActiveForm | null | undefined;

  /**
   * 도구 카탈로그 실행 이력 목록
   */
  toolCalls?:
    | Array<{
        toolName: string;
        args: Record<string, unknown>;
        result?: unknown;
      }>
    | undefined;
}
