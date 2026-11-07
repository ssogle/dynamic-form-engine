import type { Form } from "../schema/form.schema";
import type { HttpErrorData } from "@/shared/lib/http";
import { httpClient } from "@/shared/lib/http";
import { useQuery } from "@tanstack/react-query";
import { formKeys } from "./form.keys";

/**
 * 활성 폼 전체 목록 조회 API 호출 순수 함수
 *
 * @returns Form[] 목록 프로미스
 */
export const getForms = (): Promise<Form[]> => httpClient.get<Form[]>("/api/v1/forms");

/**
 * 폼 전체 목록 조회를 위한 엔티티 공용 TanStack Query 훅
 *
 * 폼 목록 화면, AI 네비게이터 대화 패널(기존 폼 탐색), 차트 빌더 등
 * 여러 상위 피처와 위젯에서 공통으로 폼 목록을 조회할 때 사용됩니다.
 */
export const useFormsQuery = () =>
  useQuery<Form[], HttpErrorData>({
    queryKey: formKeys.lists(),
    queryFn: getForms,
  });
