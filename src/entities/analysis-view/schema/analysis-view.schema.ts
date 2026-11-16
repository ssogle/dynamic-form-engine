import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { analysisViews, type AnalysisViewBlockRecord } from "@/shared/tables";

/**
 * 분석 뷰 물리 테이블 re-export
 */
export { analysisViews };

/**
 * 시스템 및 중앙 DB 시계(PostgreSQL)에 의해 전적으로 관리되는 메타데이터 필드 목록
 * 클라이언트가 임의로 주입하거나 위변조하지 못하도록 입력 스키마에서 제외합니다.
 */
const systemManagedFields = {
  id: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
  deletedAt: true,
} as const;

/**
 * 블록에서 원천 폼 데이터 목록(`/consumer/forms/[id]`)으로 이동하기 위한 출처 링크 규격
 */
export const analysisBlockSourceLinkSchema = z.object({
  formId: z.uuid("유효한 폼 ID(UUID)가 필요합니다."),
  label: z.string().min(1, "출처 링크 라벨은 필수입니다."),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "시작일은 YYYY-MM-DD 형식이어야 합니다.")
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "종료일은 YYYY-MM-DD 형식이어야 합니다.")
    .optional(),
  dateFieldId: z.string().min(1).optional(),
});

/**
 * 1. 글 블록 (Text Block)
 * 분석 요약, 데이터 항목 나열, 비교 시사점 등 서술형 콘텐츠를 담습니다.
 */
export const textAnalysisBlockSchema = z.object({
  id: z.string().min(1, "블록 ID는 필수입니다."),
  type: z.literal("text"),
  title: z.string().optional(),
  content: z.string().min(1, "본문 내용은 필수입니다."),
  sourceLinks: z.array(analysisBlockSourceLinkSchema).optional(),
});

/**
 * 2. 데이터 테이블 컬럼 규격
 */
export const tableColumnSchema = z.object({
  key: z.string().min(1, "컬럼 키는 필수입니다."),
  label: z.string().min(1, "컬럼 표시명은 필수입니다."),
  align: z.enum(["left", "center", "right"]).default("left"),
});

/**
 * 2. 데이터 테이블 블록 (Table Block)
 * 집계 비교표 또는 필터링된 근거 레코드 목록을 표 형태로 표현합니다.
 */
export const tableAnalysisBlockSchema = z.object({
  id: z.string().min(1, "블록 ID는 필수입니다."),
  type: z.literal("table"),
  title: z.string().min(1, "테이블 제목은 필수입니다."),
  description: z.string().optional(),
  columns: z.array(tableColumnSchema).min(1, "최소 1개 이상의 테이블 컬럼이 필요합니다."),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))),
  sourceLinks: z.array(analysisBlockSourceLinkSchema).optional(),
});

/**
 * 3. 차트 시리즈 규격
 */
export const chartSeriesSchema = z.object({
  key: z.string().min(1, "시리즈 데이터 키는 필수입니다."),
  label: z.string().min(1, "시리즈 표시명은 필수입니다."),
});

/**
 * 3. 차트 블록 (Chart Block)
 * 막대(bar), 꺾은선(line), 원형(pie) 비교/추이 시각화를 정의합니다.
 */
export const chartAnalysisBlockSchema = z.object({
  id: z.string().min(1, "블록 ID는 필수입니다."),
  type: z.literal("chart"),
  title: z.string().min(1, "차트 제목은 필수입니다."),
  description: z.string().optional(),
  chartType: z.enum(["bar", "line", "pie"]),
  xAxisKey: z.string().min(1, "X축 데이터 키는 필수입니다."),
  series: z.array(chartSeriesSchema).min(1, "최소 1개 이상의 차트 시리즈가 필요합니다."),
  data: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))),
  sourceLinks: z.array(analysisBlockSourceLinkSchema).optional(),
});

/**
 * 분석 뷰 문서를 구성하는 3종 콘텐츠 블록 Discriminated Union
 */
export const analysisBlockSchema = z.discriminatedUnion("type", [
  textAnalysisBlockSchema,
  tableAnalysisBlockSchema,
  chartAnalysisBlockSchema,
]);

/**
 * 신규 분석 뷰 생성 입력 검증 스키마
 */
export const insertAnalysisViewSchema = createInsertSchema(analysisViews, {
  title: (schema) =>
    schema
      .min(1, "분석 뷰 제목을 입력해 주세요.")
      .max(255, "분석 뷰 제목은 최대 255자까지 가능합니다."),
  blocks: z.array(analysisBlockSchema).default([]),
}).omit(systemManagedFields);

/**
 * 분석 뷰 수정 입력 검증 스키마 (부분 수정 허용)
 */
export const updateAnalysisViewSchema = insertAnalysisViewSchema.partial();

/**
 * 데이터베이스에서 조회된 분석 뷰 엔티티 검증 스키마
 */
export const selectAnalysisViewSchema = createSelectSchema(analysisViews, {
  blocks: z.array(analysisBlockSchema),
});

/**
 * 분석 뷰의 JSONB blocks 배열을 검증된 AnalysisBlock 배열로 안전하게 추출합니다.
 *
 * @param view 분석 뷰 엔티티 또는 blocks 레코드 배열
 * @returns 스키마 검증을 통과한 블록 목록
 */
export function extractAnalysisBlocks(
  view?: { blocks?: AnalysisViewBlockRecord[] | AnalysisBlock[] | null } | null
): AnalysisBlock[] {
  if (!view || !Array.isArray(view.blocks)) {
    return [];
  }

  return view.blocks.reduce<AnalysisBlock[]>((acc, rawBlock) => {
    const parsed = analysisBlockSchema.safeParse(rawBlock);
    if (parsed.success) {
      acc.push(parsed.data);
    }
    return acc;
  }, []);
}

export type AnalysisBlockSourceLink = z.infer<typeof analysisBlockSourceLinkSchema>;
export type TextAnalysisBlock = z.infer<typeof textAnalysisBlockSchema>;
export type TableColumn = z.infer<typeof tableColumnSchema>;
export type TableAnalysisBlock = z.infer<typeof tableAnalysisBlockSchema>;
export type ChartSeries = z.infer<typeof chartSeriesSchema>;
export type ChartAnalysisBlock = z.infer<typeof chartAnalysisBlockSchema>;
export type AnalysisBlock = z.infer<typeof analysisBlockSchema>;
export type AnalysisView = typeof analysisViews.$inferSelect;
export type InsertAnalysisView = z.infer<typeof insertAnalysisViewSchema>;
export type UpdateAnalysisView = z.infer<typeof updateAnalysisViewSchema>;
