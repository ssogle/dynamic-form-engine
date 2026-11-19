import type {
  HighRiskConfirmationToolName,
  PendingNavigatorConfirmation,
} from "../../types/navigator-action.types";

/**
 * 고위험 도구 실행 전 사전 승인(HITL) 응답 객체를 생성하는 공용 헬퍼
 *
 * 빌더·컨슈머·분석가 도구에서 DB 변이를 수행하기 직전에 호출되어,
 * LLM이 동일 도구를 반복 재시도하지 않고 사용자에게 승인 카드를 안내하도록 표준 규격을 반환합니다.
 */
export function buildPendingConfirmationResult(params: {
  toolName: HighRiskConfirmationToolName;
  title: string;
  description: string;
  targetIds: string[];
  payload: Record<string, unknown>;
}) {
  const confirmationId = crypto.randomUUID();
  const pendingConfirmation: PendingNavigatorConfirmation = {
    confirmationId,
    toolName: params.toolName,
    title: params.title,
    description: params.description,
    targetIds: params.targetIds,
    payload: params.payload,
  };

  return {
    success: true,
    requiresConfirmation: true as const,
    status: "PENDING_CONFIRMATION" as const,
    message:
      "사용자의 사전 승인이 필요한 작업입니다. 채팅 화면의 승인 카드에서 [승인]을 누르면 즉시 실행됩니다.",
    pendingConfirmation,
  };
}
