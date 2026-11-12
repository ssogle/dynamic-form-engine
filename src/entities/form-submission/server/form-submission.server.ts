import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/shared/db/server";
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

  return await db
    .update(formSubmissions)
    .set({
      deletedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(and(inArray(formSubmissions.id, validIds), isNull(formSubmissions.deletedAt)))
    .returning();
};
