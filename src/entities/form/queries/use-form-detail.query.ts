import type { Form } from "../schema/form.schema";
import type { HttpErrorData } from "@/shared/lib/http";
import { httpClient } from "@/shared/lib/http";
import { useQuery } from "@tanstack/react-query";
import { formKeys } from "./form.keys";

/**
 * 폼 단건 상세 정보 조회 API 호출 순수 함수
 *
 * @param identifier 폼 고유 식별자 (UUID id 또는 slug)
 * @returns Form 엔티티 프로미스
 */
export const getFormDetail = (identifier: string): Promise<Form> =>
  httpClient.get<Form>(`/api/v1/forms/${identifier}`);

/**
 * 폼 단건 상세 조회를 위한 TanStack Query 훅
 *
 * 프리뷰 캔버스 및 네비게이터 위젯이 현재 활성 폼의 최신 상태를
 * 서버 DB 및 캐시로부터 실시간 동기화하여 구독할 때 사용됩니다.
 *
 * @param identifier 폼 고유 식별자 (UUID id 또는 slug)
 * @param options 추가 쿼리 옵션 (enabled 등)
 */
export const useFormDetailQuery = (identifier: string, options?: { enabled?: boolean }) =>
  useQuery<Form, HttpErrorData>({
    queryKey: formKeys.detail(identifier),
    queryFn: () => getFormDetail(identifier),
    enabled: options?.enabled ?? Boolean(identifier),
  });
