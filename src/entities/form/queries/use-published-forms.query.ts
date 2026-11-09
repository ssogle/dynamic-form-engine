import type { Form } from "../schema/form.schema";
import type { HttpErrorData } from "@/shared/lib/http";
import { httpClient } from "@/shared/lib/http";
import { useQuery } from "@tanstack/react-query";
import { formKeys } from "./form.keys";

/**
 * 공식 발행된 활성 폼 목록 조회 API 호출 순수 함수
 *
 * @returns 발행된 Form[] 목록 프로미스
 */
export const getPublishedForms = (): Promise<Form[]> =>
  httpClient.get<Form[]>("/api/v1/forms", {
    params: { published: true },
  });

/**
 * 공식 발행된 활성 폼 목록 조회를 위한 엔티티 TanStack Query 훅
 *
 * 컨슈머 포털 폼 목록 화면, 컨슈머 AI 네비게이터(참여 가능 폼 안내) 등에서
 * 미발행 초안 폼을 배제하고 오직 응답 가능한 폼만 선별 조회할 때 사용됩니다.
 */
export const usePublishedFormsQuery = () =>
  useQuery<Form[], HttpErrorData>({
    queryKey: formKeys.publishedLists(),
    queryFn: getPublishedForms,
  });
