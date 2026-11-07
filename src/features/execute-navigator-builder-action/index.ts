/**
 * AI Navigator 액션 실행 슬라이스 Public API
 *
 * FSD 단방향 의존성 규칙에 따라 상위 레이어(widgets, app)는
 * 내부 파일 경로 대신 본 index.ts를 통해서만 액션 타입과 뮤테이션 훅을 참조합니다.
 */
export {
  slugRegex,
  navigateActionSchema,
  createFormActionSchema,
  updateSchemaActionSchema,
  navigatorActionSchema,
  type NavigateAction,
  type CreateFormAction,
  type UpdateSchemaAction,
  type NavigatorAction,
  type ActionResult,
  type ChatHistoryMessage,
  type ExecuteNavigatorActionPayload,
  type NavigatorExecutionResponse,
} from "./types/action.types";

export { parseNavigatorAction, sanitizeSlug } from "./lib/action-parser";

export {
  createNavigatorTools,
  extractFieldsFromForm,
  type NavigatorToolsDependencies,
} from "./lib/navigator-tools";

export {
  executeNavigatorAction,
  useNavigatorActionMutation,
} from "./queries/use-navigator.mutation";
