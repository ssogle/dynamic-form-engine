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
 * 특정 슬러그(slug)를 가진 활성 폼(소프트 삭제되지 않은 폼) 1건을 조회합니다.
 *
 * URL 경로(/builder/[slug])를 통한 폼 프리뷰 및 네비게이터 자율주행 시
 * 읽기 친화적 슬러그로 폼 데이터를 빠르게 특정할 때 사용됩니다.
 *
 * @param slug 조회할 폼 URL 고유 식별 슬러그 (예: "project-info")
 * @returns 일치하는 Form 객체 또는 undefined
 */
export const findFormBySlug = async (slug: string): Promise<Form | undefined> => {
  const [form] = await db
    .select()
    .from(forms)
    .where(and(eq(forms.slug, slug), isNull(forms.deletedAt)))
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
 * 지정된 슬러그(slug) 목록에 해당하는 활성 폼들을 단일 쿼리로 일괄 소프트 삭제합니다.
 *
 * @param slugs 소프트 삭제할 폼 고유 슬러그 배열
 * @returns 성공적으로 소프트 삭제 처리된 Form 객체 목록
 */
export const softDeleteFormsBySlugs = async (slugs: string[]): Promise<Form[]> => {
  if (slugs.length === 0) return [];

  return await db
    .update(forms)
    .set({
      deletedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(and(inArray(forms.slug, slugs), isNull(forms.deletedAt)))
    .returning();
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

/**
 * 특정 슬러그를 가진 발행된 활성 폼 1건을 조회합니다.
 * 미발행 초안 상태이거나 소프트 삭제된 폼은 undefined를 반환하여 컨슈머 접근을 원천 차단합니다.
 *
 * @param slug 조회할 폼의 고유 식별 슬러그
 * @returns 발행된 Form 객체 또는 undefined
 */
export const findPublishedFormBySlug = async (slug: string): Promise<Form | undefined> => {
  const [form] = await db
    .select()
    .from(forms)
    .where(and(eq(forms.slug, slug), isNotNull(forms.publishedAt), isNull(forms.deletedAt)))
    .limit(1);

  return form;
};
