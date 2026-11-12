import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/shared/db/server";
import { forms, relations } from "@/shared/tables";
import {
  formSubmissions,
  type FormSubmission,
  type InsertFormSubmission,
  type UpdateFormSubmission,
} from "../schema/form-submission.schema";
import {
  parseFiltersParam,
  parseSortParam,
  type PaginatedSubmissionsResponse,
} from "../schema/submission-query.schema";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 서브미션 데이터에 포함된 관계형 필드(relation) 값을 분석하여 relations 엣지 테이블을 동기화합니다.
 *
 * @param submission 대상 서브미션 객체
 */
export async function syncSubmissionRelations(submission: FormSubmission): Promise<void> {
  // 1. 해당 폼의 스키마 메타데이터 조회
  const [parentForm] = await db
    .select({ schemaDefinition: forms.schemaDefinition })
    .from(forms)
    .where(eq(forms.id, submission.formId))
    .limit(1);

  if (
    !parentForm ||
    !parentForm.schemaDefinition ||
    !Array.isArray(parentForm.schemaDefinition.fields)
  ) {
    return;
  }

  // 2. schemaDefinition에서 type === "relation"인 활성 필드 탐색
  const relationFields = parentForm.schemaDefinition.fields.filter(
    (f) => f && f.type === "relation" && !f.deletedAt && f.id
  );

  // 3. 기존 서브미션의 관계 엣지 정리 (Re-sync)
  await db.delete(relations).where(eq(relations.sourceId, submission.id));

  if (relationFields.length === 0) {
    return;
  }

  // 4. 새 엣지 레코드 조립
  const submissionData = (submission.data ?? {}) as Record<string, unknown>;
  const newEdges: Array<typeof relations.$inferInsert> = [];

  for (const field of relationFields) {
    const fieldId = String(field.id);
    const rawVal = submissionData[fieldId];
    if (!rawVal) continue;

    const targetIds: string[] = Array.isArray(rawVal)
      ? rawVal.filter((v): v is string => typeof v === "string" && UUID_REGEX.test(v))
      : typeof rawVal === "string" && UUID_REGEX.test(rawVal)
        ? [rawVal]
        : [];

    for (const targetId of targetIds) {
      newEdges.push({
        sourceId: submission.id,
        targetId,
        fieldId,
      });
    }
  }

  // 5. 엣지 레코드 일괄 삽입
  if (newEdges.length > 0) {
    await db.insert(relations).values(newEdges).onConflictDoNothing();
  }
}

/**
 * 신규 폼 응답(Submission) 데이터를 데이터베이스에 영속화합니다.
 *
 * @param data 유효성 검증을 통과한 신규 응답 데이터
 * @returns 영속화된 단일 FormSubmission 객체
 */
export const insertSubmission = async (data: InsertFormSubmission): Promise<FormSubmission> => {
  const [createdSubmission] = await db.insert(formSubmissions).values(data).returning();

  if (!createdSubmission) {
    throw new Error("응답 데이터베이스 삽입 결과가 반환되지 않았습니다.");
  }

  // 관계형 필드 엣지 동기화
  try {
    await syncSubmissionRelations(createdSubmission);
  } catch (error) {
    console.error("서브미션 관계 동기화 실패:", error);
  }

  return createdSubmission;
};

/**
 * 특정 폼 ID에 귀속된 소프트 삭제되지 않은 활성 응답 목록을 생성순(최신순)으로 조회합니다.
 * 폼 ID가 유효한 UUID 형식이 아닌 경우 빈 배열을 반환하여 데이터베이스 에러를 방지합니다.
 *
 * @param formId 조회 대상 폼 고유 식별자(UUID)
 * @returns FormSubmission[] 배열 반환
 */
export const findSubmissionsByFormId = async (formId: string): Promise<FormSubmission[]> => {
  if (!UUID_REGEX.test(formId)) {
    return [];
  }

  return await db
    .select()
    .from(formSubmissions)
    .where(and(eq(formSubmissions.formId, formId), isNull(formSubmissions.deletedAt)))
    .orderBy(desc(formSubmissions.createdAt));
};

/**
 * 특정 폼 ID에 귀속된 제출 응답(소프트 삭제 이력 포함)이 1건 이상 존재하는지 경량 조회합니다.
 * 발행 취소 후에도 과거 응답 데이터가 남아있는 폼의 필드/옵션 물리 삭제를 차단하기 위해 사용합니다.
 *
 * @param formId 조회 대상 폼 고유 식별자(UUID)
 * @returns 응답 존재 여부 (true: 1건 이상 존재, false: 응답 없음)
 */
export const hasSubmissionsByFormId = async (formId: string): Promise<boolean> => {
  if (!UUID_REGEX.test(formId)) {
    return false;
  }

  const [row] = await db
    .select({ id: formSubmissions.id })
    .from(formSubmissions)
    .where(eq(formSubmissions.formId, formId))
    .limit(1);

  return Boolean(row);
};

/**
 * 페이지네이션 조회 옵션 인터페이스
 */
export interface FindSubmissionsPaginatedOptions {
  page?: number | undefined;
  limit?: number | undefined;
  sort?: string | undefined;
  filters?: string | undefined;
}

/**
 * 특정 폼 ID의 응답 목록을 페이지네이션, 동적 JSONB 멀티 정렬, 컬럼별 ILIKE 필터를 적용하여 조회합니다.
 *
 * @param formId 조회 대상 폼 고유 식별자(UUID)
 * @param options 페이징, 정렬, 필터 옵션
 * @returns PaginatedSubmissionsResponse 페이징 응답 객체
 */
export const findSubmissionsPaginated = async (
  formId: string,
  options: FindSubmissionsPaginatedOptions = {}
): Promise<PaginatedSubmissionsResponse> => {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.max(1, Math.min(100, options.limit ?? 20));

  if (!UUID_REGEX.test(formId)) {
    return {
      items: [],
      page,
      limit,
      totalCount: 0,
      totalPages: 0,
      hasMore: false,
    };
  }

  const offset = (page - 1) * limit;

  // 1. Where 절 조립 (기본: 대상 폼 일치 및 소프트 삭제 제외)
  const conditions = [eq(formSubmissions.formId, formId), isNull(formSubmissions.deletedAt)];

  // 2. 컬럼별 필터 조립 (JSONB 동적 필드 ILIKE 검색)
  const filtersMap = parseFiltersParam(options.filters);
  for (const [fieldId, keyword] of Object.entries(filtersMap)) {
    if (!keyword) continue;
    if (fieldId === "id") {
      conditions.push(sql`${formSubmissions.id}::text ILIKE ${`%${keyword}%`}`);
    } else {
      conditions.push(sql`${formSubmissions.data}->>${fieldId} ILIKE ${`%${keyword}%`}`);
    }
  }

  const whereClause = and(...conditions);

  // 3. 총 개수(totalCount) 조회
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(formSubmissions)
    .where(whereClause);

  const totalCount = Number(countResult?.count ?? 0);
  const totalPages = Math.ceil(totalCount / limit);

  // 4. 정렬(OrderBy) 표현식 조립
  const sortItems = parseSortParam(options.sort);
  const orderByExpressions = sortItems.map((item) => {
    if (item.id === "createdAt") {
      return item.desc ? desc(formSubmissions.createdAt) : asc(formSubmissions.createdAt);
    }
    if (item.id === "updatedAt") {
      return item.desc ? desc(formSubmissions.updatedAt) : asc(formSubmissions.updatedAt);
    }
    if (item.id === "id") {
      return item.desc ? desc(formSubmissions.id) : asc(formSubmissions.id);
    }
    // 동적 JSONB 필드 정렬
    const jsonbField = sql`${formSubmissions.data}->>${item.id}`;
    return item.desc ? desc(jsonbField) : asc(jsonbField);
  });

  // 순서의 결정론적 보장을 위한 보조 정렬
  orderByExpressions.push(desc(formSubmissions.id));

  // 5. 페이징 데이터 조회
  const items = await db
    .select()
    .from(formSubmissions)
    .where(whereClause)
    .orderBy(...orderByExpressions)
    .limit(limit)
    .offset(offset);

  return {
    items,
    page,
    limit,
    totalCount,
    totalPages,
    hasMore: page < totalPages,
  };
};

/**
 * 특정 ID의 소프트 삭제되지 않은 활성 응답 1건을 조회합니다.
 * ID가 유효한 UUID 형식이 아닌 경우 undefined를 즉시 반환하여 데이터베이스 에러를 방지합니다.
 *
 * @param id 조회할 응답 고유 식별자(UUID)
 * @returns 일치하는 FormSubmission 객체 또는 undefined
 */
export const findSubmissionById = async (id: string): Promise<FormSubmission | undefined> => {
  if (!UUID_REGEX.test(id)) {
    return undefined;
  }

  const [submission] = await db
    .select()
    .from(formSubmissions)
    .where(and(eq(formSubmissions.id, id), isNull(formSubmissions.deletedAt)))
    .limit(1);

  return submission;
};

/**
 * 특정 ID의 기제출된 응답 데이터(data)를 수정하고 updatedAt을 중앙 DB 시계(sql`now()`)로 갱신합니다.
 *
 * @param id 수정할 응답 고유 식별자(UUID)
 * @param data 수정할 응답 데이터
 * @returns 수정된 FormSubmission 객체 또는 대상이 없을 경우 undefined
 */
export const updateSubmissionById = async (
  id: string,
  data: UpdateFormSubmission
): Promise<FormSubmission | undefined> => {
  if (!UUID_REGEX.test(id)) {
    return undefined;
  }

  const [updatedSubmission] = await db
    .update(formSubmissions)
    .set({
      ...data,
      updatedAt: sql`now()`,
    })
    .where(and(eq(formSubmissions.id, id), isNull(formSubmissions.deletedAt)))
    .returning();

  if (updatedSubmission) {
    try {
      await syncSubmissionRelations(updatedSubmission);
    } catch (error) {
      console.error("서브미션 관계 수정 동기화 실패:", error);
    }
  }

  return updatedSubmission;
};

/**
 * 특정 ID의 응답을 소프트 삭제(deletedAt 및 updatedAt을 중앙 DB 시각으로 갱신)합니다.
 *
 * @param id 소프트 삭제할 응답 고유 식별자(UUID)
 * @returns 소프트 삭제된 FormSubmission 객체 또는 대상이 없을 경우 undefined
 */
export const softDeleteSubmissionById = async (id: string): Promise<FormSubmission | undefined> => {
  if (!UUID_REGEX.test(id)) {
    return undefined;
  }

  const [deletedSubmission] = await db
    .update(formSubmissions)
    .set({
      deletedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(formSubmissions.id, id), isNull(formSubmissions.deletedAt)))
    .returning();

  if (deletedSubmission) {
    try {
      await db.delete(relations).where(eq(relations.sourceId, deletedSubmission.id));
    } catch (error) {
      console.error("서브미션 관계 단건 삭제 동기화 실패:", error);
    }
  }

  return deletedSubmission;
};

/**
 * 지정된 복수 ID의 응답들을 소프트 삭제(deletedAt 및 updatedAt을 중앙 DB 시각으로 갱신)합니다.
 *
 * @param ids 소프트 삭제할 응답 고유 식별자(UUID) 배열
 * @returns 소프트 삭제된 FormSubmission 객체 배열
 */
export const softDeleteSubmissionsByIds = async (ids: string[]): Promise<FormSubmission[]> => {
  const validIds = ids.filter((id) => UUID_REGEX.test(id));
  if (validIds.length === 0) {
    return [];
  }

  const deletedSubmissions = await db
    .update(formSubmissions)
    .set({
      deletedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(and(inArray(formSubmissions.id, validIds), isNull(formSubmissions.deletedAt)))
    .returning();

  if (validIds.length > 0) {
    try {
      await db.delete(relations).where(inArray(relations.sourceId, validIds));
    } catch (error) {
      console.error("서브미션 관계 일괄 삭제 동기화 실패:", error);
    }
  }

  return deletedSubmissions;
};
