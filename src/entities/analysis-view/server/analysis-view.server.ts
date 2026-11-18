import "server-only";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/shared/db/server";
import {
  analysisViews,
  type AnalysisView,
  type InsertAnalysisView,
  type UpdateAnalysisView,
} from "../schema/analysis-view.schema";

/**
 * 활성 분석 뷰(소프트 삭제되지 않은 문서) 목록을 최종 수정·생성 최신순으로 조회합니다.
 *
 * @returns AnalysisView[] 배열 반환
 */
export const findActiveAnalysisViews = async (): Promise<AnalysisView[]> => {
  return await db
    .select()
    .from(analysisViews)
    .where(isNull(analysisViews.deletedAt))
    .orderBy(desc(analysisViews.updatedAt), desc(analysisViews.createdAt));
};

/**
 * 공식 발행된 활성 분석 뷰 목록을 발행 일시 최신순으로 조회합니다.
 * 컨슈머 포털(`/consumer`)의 공유 뷰 목록 노출에 사용됩니다.
 *
 * @returns 발행된 AnalysisView[] 배열 반환
 */
export const findPublishedAnalysisViews = async (): Promise<AnalysisView[]> => {
  return await db
    .select()
    .from(analysisViews)
    .where(and(isNotNull(analysisViews.publishedAt), isNull(analysisViews.deletedAt)))
    .orderBy(desc(analysisViews.publishedAt), desc(analysisViews.updatedAt));
};

/**
 * 특정 ID를 가진 활성 분석 뷰 1건을 조회합니다.
 *
 * @param id 분석 뷰 고유 식별자(UUID)
 * @returns 일치하는 AnalysisView 객체 또는 undefined
 */
export const findAnalysisViewById = async (id: string): Promise<AnalysisView | undefined> => {
  const [view] = await db
    .select()
    .from(analysisViews)
    .where(and(eq(analysisViews.id, id), isNull(analysisViews.deletedAt)))
    .limit(1);

  return view;
};

/**
 * 특정 ID를 가진 발행 완료 상태의 활성 분석 뷰 1건을 조회합니다.
 *
 * @param id 분석 뷰 고유 식별자(UUID)
 * @returns 발행된 AnalysisView 객체 또는 undefined
 */
export const findPublishedAnalysisViewById = async (
  id: string
): Promise<AnalysisView | undefined> => {
  const [view] = await db
    .select()
    .from(analysisViews)
    .where(
      and(
        eq(analysisViews.id, id),
        isNotNull(analysisViews.publishedAt),
        isNull(analysisViews.deletedAt)
      )
    )
    .limit(1);

  return view;
};

/**
 * 신규 분석 뷰 문서를 데이터베이스에 영속화합니다.
 *
 * @param data 유효성 검증을 통과한 신규 분석 뷰 입력 데이터
 * @returns 영속화된 단일 AnalysisView 객체
 */
export const insertAnalysisView = async (data: InsertAnalysisView): Promise<AnalysisView> => {
  const [created] = await db.insert(analysisViews).values(data).returning();

  if (!created) {
    throw new Error("분석 뷰 데이터베이스 삽입 결과가 반환되지 않았습니다.");
  }

  return created;
};

/**
 * 특정 ID의 분석 뷰 메타데이터 또는 블록 구성을 수정하고 updatedAt을 DB 중앙 시계로 갱신합니다.
 *
 * @param id 수정할 분석 뷰 고유 식별자(UUID)
 * @param data 수정할 분석 뷰 부분 데이터
 * @returns 수정된 AnalysisView 객체 또는 대상이 없을 경우 undefined
 */
export const updateAnalysisViewById = async (
  id: string,
  data: UpdateAnalysisView
): Promise<AnalysisView | undefined> => {
  const [updated] = await db
    .update(analysisViews)
    .set({
      ...data,
      updatedAt: sql`now()`,
    })
    .where(and(eq(analysisViews.id, id), isNull(analysisViews.deletedAt)))
    .returning();

  return updated;
};

/**
 * 특정 ID의 분석 뷰 발행 상태를 전환합니다.
 *
 * @param id 발행 상태를 변경할 분석 뷰 ID(UUID)
 * @param isPublished true: 공식 발행(publishedAt 기록), false: 초안 회수(null)
 * @returns 갱신된 AnalysisView 객체 또는 대상이 없을 경우 undefined
 */
export const publishAnalysisViewById = async (
  id: string,
  isPublished: boolean
): Promise<AnalysisView | undefined> => {
  const [updated] = await db
    .update(analysisViews)
    .set({
      publishedAt: isPublished ? sql`now()` : null,
      updatedAt: sql`now()`,
    })
    .where(and(eq(analysisViews.id, id), isNull(analysisViews.deletedAt)))
    .returning();

  return updated;
};

/**
 * 특정 ID의 분석 뷰 1건을 소프트 삭제합니다.
 *
 * @param id 소프트 삭제할 분석 뷰 ID(UUID)
 * @returns 삭제 처리된 AnalysisView 객체 또는 대상이 없을 경우 undefined
 */
export const softDeleteAnalysisViewById = async (id: string): Promise<AnalysisView | undefined> => {
  const [deleted] = await db
    .update(analysisViews)
    .set({
      deletedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(analysisViews.id, id), isNull(analysisViews.deletedAt)))
    .returning();

  return deleted;
};

/**
 * 지정된 ID 목록에 해당하는 활성 분석 뷰들을 단일 쿼리로 일괄 소프트 삭제합니다.
 *
 * @param ids 소프트 삭제할 분석 뷰 고유 식별자(UUID) 배열
 * @returns 성공적으로 소프트 삭제 처리된 AnalysisView 객체 목록
 */
export const softDeleteAnalysisViewsByIds = async (ids: string[]): Promise<AnalysisView[]> => {
  if (ids.length === 0) return [];

  return await db
    .update(analysisViews)
    .set({
      deletedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(and(inArray(analysisViews.id, ids), isNull(analysisViews.deletedAt)))
    .returning();
};
