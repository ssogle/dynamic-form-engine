"use client";

import * as React from "react";
import { useQueries } from "@tanstack/react-query";
import { formKeys, getFormDetail, type CoreFormField } from "@/entities/form";
import {
  formSubmissionsKeys,
  getFormSubmissionsByIds,
  type FormSubmission,
} from "@/entities/form-submission";
import {
  buildRelationLookupMap,
  extractRelationTargets,
  type RelationLookupMap,
} from "../lib/relation-summary";
import type { FieldFilterCondition } from "@/shared/schema";

export interface UseRelationLookupReturn {
  lookupMap: RelationLookupMap;
  isLoading: boolean;
}

/**
 * 부모 폼의 활성 관계형 필드들과 현재 로드된 서브미션 목록·활성 필터를 분석하여,
 * 참조된 모든 타깃 폼 메타데이터와 타깃 레코드들을 React Query `useQueries`로
 * 일괄(Batch) 병렬 페칭한 뒤 O(1) 조회 딕셔너리로 반환하는 공용 훅입니다.
 *
 * 목록 테이블 요약 렌더링과 단건 상세 화면의 관계형 테이블 렌더링에서 공통으로 재사용합니다.
 */
export function useRelationLookup(
  fields: CoreFormField[],
  submissions: FormSubmission[],
  filterConditions?: ReadonlyArray<FieldFilterCondition>
): UseRelationLookupReturn {
  const relationTargets = React.useMemo(
    () => extractRelationTargets(fields, submissions, filterConditions),
    [fields, submissions, filterConditions]
  );

  // 1. 참조된 고유 타깃 폼 스키마 메타데이터 배치 조회 (primaryFieldId 및 컬럼 정의 확보용)
  const formQueries = useQueries({
    queries: relationTargets.map((target) => ({
      queryKey: formKeys.detail(target.targetFormId),
      queryFn: () => getFormDetail(target.targetFormId),
      enabled: Boolean(target.targetFormId),
      staleTime: 60_000,
    })),
  });

  // 2. 참조된 타깃 폼별 선택 레코드 UUID 목록 배치 조회
  const submissionBatchQueries = useQueries({
    queries: relationTargets.map((target) => ({
      queryKey: formSubmissionsKeys.byIds(target.targetFormId, target.submissionIds),
      queryFn: () => getFormSubmissionsByIds(target.targetFormId, target.submissionIds),
      enabled: Boolean(target.targetFormId && target.submissionIds.length > 0),
      staleTime: 30_000,
    })),
  });

  const isLoading =
    formQueries.some((q) => q.isLoading) || submissionBatchQueries.some((q) => q.isLoading);

  const lookupMap = React.useMemo(() => {
    const targetForms = formQueries.map((q) => q.data);
    const targetSubmissions = submissionBatchQueries.flatMap((q) => q.data ?? []);
    return buildRelationLookupMap(targetForms, targetSubmissions);
  }, [formQueries, submissionBatchQueries]);

  return {
    lookupMap,
    isLoading,
  };
}
