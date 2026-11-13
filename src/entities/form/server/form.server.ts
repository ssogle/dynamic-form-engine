import "server-only";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/shared/db/server";
import { forms, type Form, type InsertForm, type UpdateForm } from "../schema/form.schema";

/**
 * 활성 폼(소프트 삭제되지 않은 폼) 목록을 생성 일시 최신순으로 조회합니다.
 *
 * @returns Form[] 배열 반환
 */
export const findActiveForms = async (): Promise<Form[]> => {
  return await db
    .select()
    .from(forms)
    .where(isNull(forms.deletedAt))
    .orderBy(desc(forms.createdAt));
};

/**
 * 특정 ID를 가진 활성 폼(소프트 삭제되지 않은 폼) 1건을 조회합니다.
 * API 경계에서 UUID 검증이 완료된 식별자만 전달받는 것을 전제로 순수 DB 조회를 수행합니다.
 *
 * @param id 조회할 폼 고유 식별자(UUID)
 * @returns 일치하는 Form 객체 또는 undefined
 */
export const findFormById = async (id: string): Promise<Form | undefined> => {
  const [form] = await db
    .select()
    .from(forms)
    .where(and(eq(forms.id, id), isNull(forms.deletedAt)))
    .limit(1);

  return form;
};

/**
 * 특정 ID를 가진 발행된 활성 폼 1건을 조회합니다.
 * 미발행 초안 상태이거나 소프트 삭제된 폼은 undefined를 반환하여 컨슈머 접근을 원천 차단합니다.
 *
 * @param id 조회할 폼의 고유 식별자(UUID)
 * @returns 발행된 Form 객체 또는 undefined
 */
export const findPublishedFormById = async (id: string): Promise<Form | undefined> => {
  const [form] = await db
    .select()
    .from(forms)
    .where(and(eq(forms.id, id), isNotNull(forms.publishedAt), isNull(forms.deletedAt)))
    .limit(1);

  return form;
};

/**
 * 신규 폼 메타데이터를 데이터베이스에 영속화합니다.
 *
 * @param data 유효성 검증을 통과한 신규 폼 데이터
 * @returns 영속화된 단일 Form 객체
 */
export const insertForm = async (data: InsertForm): Promise<Form> => {
  const [createdForm] = await db.insert(forms).values(data).returning();

  if (!createdForm) {
    throw new Error("폼 데이터베이스 삽입 결과가 반환되지 않았습니다.");
  }

  return createdForm;
};

/**
 * 특정 ID의 폼 메타데이터를 수정하고 updatedAt을 현재 일시로 갱신합니다.
 *
 * @param id 수정할 폼 고유 식별자(UUID)
 * @param data 수정할 폼 메타데이터
 * @returns 수정된 Form 객체 또는 수정 대상이 없을 경우 undefined
 */
export const updateFormById = async (id: string, data: UpdateForm): Promise<Form | undefined> => {
  const [updatedForm] = await db
    .update(forms)
    .set({
      ...data,
      updatedAt: sql`now()`,
    })
    .where(and(eq(forms.id, id), isNull(forms.deletedAt)))
    .returning();

  return updatedForm;
};

/**
 * 특정 ID의 폼을 소프트 삭제(deletedAt 컬럼을 DB 현재 일시로 갱신)합니다.
 *
 * @param id 소프트 삭제할 폼 고유 식별자(UUID)
 * @returns 소프트 삭제된 Form 객체 또는 대상이 없을 경우 undefined
 */
export const softDeleteFormById = async (id: string): Promise<Form | undefined> => {
  const [deletedForm] = await db
    .update(forms)
    .set({
      deletedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(forms.id, id), isNull(forms.deletedAt)))
    .returning();

  return deletedForm;
};

/**
 * 지정된 ID 목록에 해당하는 활성 폼들을 단일 쿼리로 일괄 소프트 삭제합니다.
 *
 * @param ids 소프트 삭제할 폼 고유 식별자(UUID) 배열
 * @returns 성공적으로 소프트 삭제 처리된 Form 객체 목록
 */
export const softDeleteFormsByIds = async (ids: string[]): Promise<Form[]> => {
  if (ids.length === 0) return [];

  return await db
    .update(forms)
    .set({
      deletedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(and(inArray(forms.id, ids), isNull(forms.deletedAt)))
    .returning();
};

/**
 * 특정 ID의 폼을 공식 발행하거나 초안 상태로 회수(비발행)합니다.
 *
 * 발행 시간(publishedAt)은 클라이언트의 시간을 일체 신뢰하지 않고,
 * PostgreSQL 중앙 시계인 sql`now()`를 사용하여 원천적으로 정합성을 보장합니다.
 * 초안 회수 시에는 publishedAt 컬럼을 null로 초기화합니다.
 *
 * @param id 발행 상태를 변경할 폼 고유 식별자(UUID)
 * @param isPublished true: 공식 공개 발행, false: 미발행 초안 회수
 * @returns 갱신된 Form 객체 또는 대상 폼이 없을 경우 undefined
 */
export const publishFormById = async (
  id: string,
  isPublished: boolean
): Promise<Form | undefined> => {
  const [updatedForm] = await db
    .update(forms)
    .set({
      publishedAt: isPublished ? sql`now()` : null,
      updatedAt: sql`now()`,
    })
    .where(and(eq(forms.id, id), isNull(forms.deletedAt)))
    .returning();

  return updatedForm;
};

/**
 * 공식 발행(publishedAt IS NOT NULL)되었으며 소프트 삭제되지 않은 활성 폼 목록을 조회합니다.
 * 컨슈머 포털에서 일반 응답자가 참여 가능한 폼 목록을 렌더링할 때 사용됩니다.
 *
 * @returns 발행된 Form[] 배열 반환 (최신 생성일순 정렬)
 */
export const findPublishedForms = async (): Promise<Form[]> => {
  return await db
    .select()
    .from(forms)
    .where(and(isNotNull(forms.publishedAt), isNull(forms.deletedAt)))
    .orderBy(desc(forms.createdAt));
};
