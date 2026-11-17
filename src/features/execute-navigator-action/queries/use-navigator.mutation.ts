import { useMutation, useQueryClient } from "@tanstack/react-query";
import { httpClient } from "@/shared/lib/http";
import { formKeys } from "@/entities/form";
import type {
  ExecuteNavigatorPayload,
  NavigatorExecutionResponse,
  NavigatorStreamEvent,
} from "../types/navigator-action.types";

/**
 * 진행 상태 콜백에 전달되는 메타데이터
 * - `isHeartbeat`: 실제 작업 단계가 아닌 스트림 유휴 방지용 경과 알림 여부
 */
export interface NavigatorProgressMeta {
  isHeartbeat?: boolean;
}

/**
 * 스트림 진행 상태 수신 콜백 타입
 */
export type NavigatorProgressHandler = (statusText: string, meta?: NavigatorProgressMeta) => void;

/**
 * 네비게이터 서버 액션 실행 API 호출 순수 함수 (단건 JSON 응답)
 *
 * @param payload 실행 요청 페이로드 (mode, prompt, messages, currentContext)
 * @returns AI 답변 및 브라우저 제어 액션
 */
export async function executeNavigatorAction(
  payload: ExecuteNavigatorPayload
): Promise<NavigatorExecutionResponse> {
  return httpClient.post<NavigatorExecutionResponse>("/api/v1/navigator", payload);
}

/**
 * 실시간 진행 단계(`status`) 및 경과 알림(`heartbeat`)을 공용 httpClient.streamNdjson으로 수신하면서
 * 네비게이터 서버 액션을 실행합니다.
 *
 * - 30초 무활동 타임아웃 및 75초 전체 요청 타임아웃을 적용하여 스트림 정체 시 UI 대기를 방지합니다.
 *
 * @param payload 실행 요청 페이로드
 * @param onProgress 단계별 상태 메시지 및 heartbeat 메타 수신 콜백
 * @returns 최종 AI 답변 및 브라우저 제어 액션
 */
export async function executeNavigatorActionStream(
  payload: ExecuteNavigatorPayload,
  onProgress?: NavigatorProgressHandler
): Promise<NavigatorExecutionResponse> {
  let finalResult: NavigatorExecutionResponse | null = null;

  await httpClient.streamNdjson<NavigatorStreamEvent>("/api/v1/navigator", payload, {
    params: { stream: 1 },
    inactivityTimeoutMs: 30_000,
    totalTimeoutMs: 75_000,
    onEvent: (event) => {
      if (event.type === "status") {
        onProgress?.(event.message, { isHeartbeat: false });
      } else if (event.type === "heartbeat") {
        onProgress?.(event.message, { isHeartbeat: true });
      } else if (event.type === "result") {
        finalResult = event.data;
      } else if (event.type === "error") {
        throw new Error(event.message || "AI 네비게이터 실행 중 오류가 발생했습니다.");
      }
    },
  });

  if (!finalResult) {
    throw new Error("AI 네비게이터 응답 스트림이 비정상 종료되었습니다.");
  }

  return finalResult;
}

export interface UseNavigatorMutationOptions {
  /** 다중 스텝 실행 중 서버가 내려주는 진행 상태 메시지를 받을 콜백 */
  onProgress?: NavigatorProgressHandler | undefined;
}

/**
 * AI Navigator 액션 실행 전용 TanStack Mutation 훅
 *
 * - `onProgress` 전달 시 `?stream=1` NDJSON 엔드포인트로 단계별 상태를 실시간 수신합니다.
 * - 스키마 조작이나 폼 생성, 발행 등의 액션이 서버에서 수행되면 관련 TanStack Query 캐시를 무효화합니다.
 */
export function useNavigatorMutation(options?: UseNavigatorMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation<NavigatorExecutionResponse, Error, ExecuteNavigatorPayload>({
    mutationFn: (payload) =>
      options?.onProgress
        ? executeNavigatorActionStream(payload, options.onProgress)
        : executeNavigatorAction(payload),
    onSuccess: (data) => {
      if (data.action) {
        switch (data.action.type) {
          case "CREATE_FORM":
          case "DELETE_FORMS":
          case "PUBLISH_FORM":
            // 폼 목록 쿼리 캐시 무효화
            queryClient.invalidateQueries({ queryKey: formKeys.all });
            break;

          case "UPDATE_SCHEMA":
            // 폼 목록 및 해당 폼 상세 캐시 무효화
            queryClient.invalidateQueries({ queryKey: formKeys.all });
            if (data.action.formId) {
              queryClient.invalidateQueries({
                queryKey: formKeys.detail(data.action.formId),
              });
            }
            break;

          default:
            break;
        }
      }
    },
  });
}
