import type { FormSubmission } from "../schema/form-submission.schema";

/**
 * 특정 타깃 응답을 참조(relation)하는 소스 폼과 해당 응답 목록을 묶은 역참조 그룹 타입
 *
 * 아키텍처 의도:
 * - 순수 정적 타입 파일(`types/*.types.ts`) 거버넌스에 따라 Zod 런타임 스키마를 import하지 않습니다.
 * - 서버 조회 함수(`findInboundRelatedSubmissions`), 클라이언트 TanStack Query(`useRelatedSubmissionsQuery`),
 *   그리고 관리 UI(`manage-form-submissions`)가 동일한 데이터 계약을 단일 진실 원천으로 공유합니다.
 */
export interface RelatedSubmissionsGroup {
  /** 역참조를 발생시킨 소스 폼 메타데이터 요약 */
  sourceForm: {
    /** 소스 폼 고유 식별자(UUID) */
    id: string;
    /** 소스 폼 제목 */
    title: string;
    /** 소스 폼의 동적 필드 스키마 정의 (표시 컬럼 및 라벨 해석용) */
    schemaDefinition?: unknown;
  };
  /** 해당 소스 폼에 속하며 targetId를 참조 중인 소프트 삭제 제외 활성 응답 목록 */
  submissions: FormSubmission[];
}
