import type { NextRequest } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/shared/db/server";
import { forms, formSubmissions, relations } from "@/shared/tables";
import { apiResponse, badRequest, withErrorHandler } from "@/shared/lib/http";
import type { FormSubmission } from "@/entities/form-submission";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 역참조 그룹 응답 인터페이스
 */
export interface RelatedGroupResponse {
  /**
   * 참조를 생성한 소스 폼 메타데이터
   */
  sourceForm: {
    id: string;
    title: string;
    schemaDefinition?: unknown;
  };

  /**
   * 해당 소스 폼에 등록된 참조 서브미션 목록
   */
  submissions: FormSubmission[];
}

/**
 * GET /api/v1/relations?targetId=[UUID]
 *
 * 특정 대상 레코드(targetId)를 참조하고 있는 역방향 관계(Inbound Relations) 데이터를
 * Two-Phase Query(1단계 엣지 탐색 -> 2단계 엔티티 일괄 조회) 아키텍처로 조회합니다.
 *
 * @param req NextRequest 객체 (쿼리 파라미터: targetId)
 * @returns 200 OK와 함께 소스 폼별로 그룹화된 RelatedGroupResponse[] 배열 반환
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const searchParams = req.nextUrl.searchParams;
  const targetId = searchParams.get("targetId");

  // 1. targetId 유효성 검증
  if (!targetId || !UUID_REGEX.test(targetId)) {
    throw badRequest("올바른 targetId(UUID) 쿼리 파라미터가 필요합니다.");
  }

  // 2. [Phase 1] relations 엣지 테이블에서 targetId를 가리키는 링크 탐색
  const edges = await db.select().from(relations).where(eq(relations.targetId, targetId));

  if (edges.length === 0) {
    return apiResponse.ok<RelatedGroupResponse[]>([]);
  }

  // 3. [Phase 2] 연결된 소스 서브미션 식별자 목록 추출 및 일괄 조회
  const sourceIds = Array.from(new Set(edges.map((e) => e.sourceId)));

  const sourceSubmissions = await db
    .select()
    .from(formSubmissions)
    .where(and(inArray(formSubmissions.id, sourceIds), isNull(formSubmissions.deletedAt)));

  if (sourceSubmissions.length === 0) {
    return apiResponse.ok<RelatedGroupResponse[]>([]);
  }

  // 4. 소스 폼 메타데이터 일괄 조회
  const formIds = Array.from(new Set(sourceSubmissions.map((s) => s.formId)));

  const sourceForms = await db
    .select({
      id: forms.id,
      title: forms.title,
      schemaDefinition: forms.schemaDefinition,
    })
    .from(forms)
    .where(inArray(forms.id, formIds));

  const formMap = new Map(sourceForms.map((f) => [f.id, f]));
  const submissionMap = new Map(sourceSubmissions.map((s) => [s.id, s]));

  // 5. 소스 폼 단위로 데이터 그룹화
  const groupsMap = new Map<string, RelatedGroupResponse>();

  for (const edge of edges) {
    const sub = submissionMap.get(edge.sourceId);
    if (!sub) continue; // 소프트 삭제된 서브미션 제외

    const formMeta = formMap.get(sub.formId);
    if (!formMeta) continue; // 존재하지 않는 폼 제외

    if (!groupsMap.has(sub.formId)) {
      groupsMap.set(sub.formId, {
        sourceForm: {
          id: formMeta.id,
          title: formMeta.title,
          schemaDefinition: formMeta.schemaDefinition,
        },
        submissions: [],
      });
    }

    const group = groupsMap.get(sub.formId)!;
    if (!group.submissions.some((s) => s.id === sub.id)) {
      group.submissions.push(sub);
    }
  }

  const result = Array.from(groupsMap.values());
  return apiResponse.ok<RelatedGroupResponse[]>(result);
});
