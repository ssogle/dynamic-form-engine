import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/shared/db";
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
      updatedAt: new Date(),
    })
    .where(and(eq(forms.id, id), isNull(forms.deletedAt)))
    .returning();

  return updatedForm;
};

/**
 * 특정 ID의 폼을 소프트 삭제(deletedAt 컬럼을 현재 일시로 갱신)합니다.
 *
 * @param id 소프트 삭제할 폼 고유 식별자(UUID)
 * @returns 소프트 삭제된 Form 객체 또는 대상이 없을 경우 undefined
 */
export const softDeleteFormById = async (id: string): Promise<Form | undefined> => {
  const [deletedForm] = await db
    .update(forms)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(forms.id, id), isNull(forms.deletedAt)))
    .returning();

  return deletedForm;
};
