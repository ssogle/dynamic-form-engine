import { z } from "zod";
import { analysisBlockSchema } from "@/entities/analysis-view";
import {
  coreFormFieldSchema,
  selectOptionSchema,
  validatePrimaryFieldSelection,
} from "@/entities/form";

/**
 * 폼 스키마 변경 오퍼레이션 상수 목록 (단일 진실 원천 - SSOT)
 */
export const SCHEMA_OPERATIONS = [
  "ADD_FIELD",
  "UPDATE_FIELD",
  "REMOVE_FIELD",
  "SET_ALL_FIELDS",
  "SET_PRIMARY_FIELD",
] as const;

/**
 * 폼 스키마 변경 오퍼레이션 Zod 스키마 (Builder 전용)
 */
export const schemaOperationSchema = z.enum(SCHEMA_OPERATIONS);

/**
 * 폼 스키마 변경 오퍼레이션 유형 (Builder 전용)
 */
export type SchemaOperation = z.infer<typeof schemaOperationSchema>;

/**
 * 분석 뷰 문서 편집 오퍼레이션 상수 목록 (단일 진실 원천 - SSOT)
 */
export const ANALYSIS_VIEW_OPERATIONS = [
  "ADD_BLOCK",
  "UPDATE_BLOCK",
  "REMOVE_BLOCK",
  "REORDER_BLOCKS",
  "UPDATE_INFO",
  "SET_ALL_BLOCKS",
] as const;

/**
 * 분석 뷰 문서 편집 오퍼레이션 Zod 스키마 (Analyst 전용)
 */
export const analysisViewOperationSchema = z.enum(ANALYSIS_VIEW_OPERATIONS);

/**
 * 분석 뷰 문서 편집 오퍼레이션 유형 (Analyst 전용)
 */
export type AnalysisViewOperation = z.infer<typeof analysisViewOperationSchema>;

// ==========================================
// 1. 공통 폼 조회 도구 입력 스키마 (Query Tools)
// ==========================================

/**
 * 등록된 폼 목록 키워드 검색 도구(searchForms) 입력 스키마
 */
export const searchFormsInputSchema = z.object({
  keyword: z
    .string()
    .optional()
    .describe("검색할 폼 제목이나 설명 키워드 (생략 시 전체 폼 목록 반환)"),
  mode: z
    .enum(["builder", "consumer"])
    .optional()
    .default("consumer")
    .describe("검색 대상 모드 (builder: 전체 활성 폼, consumer: 발행된 공개 폼)"),
});
export type SearchFormsInput = z.infer<typeof searchFormsInputSchema>;

/**
 * 특정 폼 상세 필드 스펙 조회 도구(getFormDetails) 입력 스키마
 */
export const getFormDetailsInputSchema = z.object({
  formId: z
    .uuid("조회할 폼 ID(UUID)는 필수입니다.")
    .describe("필드 스펙을 조회할 대상 폼의 고유 ID (UUID)"),
});
export type GetFormDetailsInput = z.infer<typeof getFormDetailsInputSchema>;

// ==========================================
// 2. 빌더 도구 입력 스키마 (Builder Tools)
// ==========================================

/**
 * 화면 이동 도구(navigate) 입력 스키마
 */
export const navigateInputSchema = z.object({
  targetPath: z.string().describe("이동할 절대 경로 (예: /builder/forms, /builder/forms/[id])"),
  reason: z.string().optional().describe("이동 사유 또는 목적"),
});
export type NavigateInput = z.infer<typeof navigateInputSchema>;

/**
 * 신규 폼 생성 도구(createForm) 입력 스키마
 *
 * 생성할 fields 배열 내 유효한 대표 필드(primaryFieldId) 지정 여부를 superRefine으로 검증합니다.
 */
export const createFormInputSchema = z
  .object({
    title: z.string().min(1, "폼 제목은 필수입니다.").describe("폼 제목"),
    description: z.string().optional().describe("폼에 대한 설명"),
    primaryFieldId: z
      .string({ message: "대표 식별자 필드(primaryFieldId) 지정은 필수입니다." })
      .trim()
      .min(1, "대표 식별자 필드(primaryFieldId) 지정은 필수입니다.")
      .describe(
        "이 도메인 레코드를 대표하여 식별할 기본 필드 ID (반드시 fields에 포함되고 checkbox·relation이 아닌 활성 필드 ID여야 함)"
      ),
    fields: z
      .array(coreFormFieldSchema)
      .min(1, "폼에는 최소 1개 이상의 필드가 포함되어야 합니다.")
      .describe(
        "생성할 초기 필드 배열 (text, textarea, number, select, radio, checkbox, date, switch, relation — 모든 필드에 description 필수)"
      ),
  })
  .superRefine((val, ctx) => {
    const check = validatePrimaryFieldSelection(val.fields, val.primaryFieldId);
    if (!check.isValid) {
      ctx.addIssue({
        code: "custom",
        path: ["primaryFieldId"],
        message: check.reason ?? "유효하지 않은 대표 필드(primaryFieldId)입니다.",
      });
    }
  });
export type CreateFormInput = z.infer<typeof createFormInputSchema>;

/**
 * 기존 폼 스키마 수정 도구(updateSchema) 입력 스키마
 */
export const updateSchemaInputSchema = z.object({
  formId: z.uuid("수정 대상 폼의 ID(UUID)는 필수입니다.").describe("수정할 대상 폼의 고유 ID"),
  operation: schemaOperationSchema.describe(
    "수행할 스키마 조작 유형 (단일 필드 수정은 UPDATE_FIELD, 다중 수정이나 복합 필드 변경 시에는 SET_ALL_FIELDS, 대표 식별 필드 변경 시에는 SET_PRIMARY_FIELD 사용)"
  ),
  targetFieldId: z
    .string()
    .optional()
    .describe("수정/삭제 대상 필드 식별자 (단일 필드 ADD/REMOVE/UPDATE 시 사용)"),
  primaryFieldId: z
    .string()
    .optional()
    .describe(
      "대표 식별자 필드(primaryFieldId)로 지정하거나 교체할 활성 필드의 ID 또는 라벨 (SET_PRIMARY_FIELD 시 필수, SET_ALL_FIELDS에서 기존 대표 필드를 대체할 때도 전달)"
    ),
  fieldData: coreFormFieldSchema.partial().optional().describe("추가 또는 변경할 단일 필드 데이터"),
  fields: z
    .array(coreFormFieldSchema)
    .optional()
    .describe("전체 필드 일괄 교체 시 전달하는 완성된 필드 목록 (SET_ALL_FIELDS 시 필수)"),
  formTitle: z.string().optional().describe("변경할 폼 제목"),
});
export type UpdateSchemaInput = z.infer<typeof updateSchemaInputSchema>;

/**
 * 폼 발행 상태 토글 도구(publishForm) 입력 스키마
 */
export const publishFormInputSchema = z.object({
  formId: z
    .uuid("발행 대상 폼의 ID(UUID)는 필수입니다.")
    .describe("발행 상태를 변경할 대상 폼의 고유 ID"),
  isPublished: z.boolean().describe("발행 여부 (true: 공개 발행, false: 비발행/초안 회수)"),
});
export type PublishFormInput = z.infer<typeof publishFormInputSchema>;

/**
 * 폼 소프트 삭제 도구(deleteForms) 입력 스키마
 */
export const deleteFormsInputSchema = z.object({
  formIds: z
    .array(z.uuid())
    .min(1, "삭제할 폼 ID는 최소 1개 이상이어야 합니다.")
    .describe("삭제할 대상 폼의 UUID 배열 (단일 폼 삭제 시에도 원소가 1개인 배열로 전달)"),
  reason: z.string().optional().describe("삭제 사유"),
});
export type DeleteFormsInput = z.infer<typeof deleteFormsInputSchema>;

/**
 * 관계형 필드 추가 도구(addRelationField) 입력 스키마
 */
export const addRelationFieldInputSchema = z.object({
  formId: z
    .uuid("현재 작업 중인 폼의 ID(UUID)는 필수입니다.")
    .describe("관계형 필드를 추가할 폼의 ID"),
  label: z
    .string()
    .min(1, "필드 라벨을 입력해 주세요.")
    .describe("화면에 표시될 관계형 필드 라벨 (예: '참조 프로젝트', '소속 부서')"),
  targetFormId: z
    .uuid("참조할 대상 폼의 ID(UUID)는 필수입니다.")
    .describe("관계(외래키)를 맺을 타깃 도메인 폼의 UUID"),
  multiple: z
    .boolean()
    .default(false)
    .describe("다중 선택 허용 여부 (기본값: false - 단일 레코드 참조)"),
  required: z.boolean().default(false).describe("필수 선택 여부"),
  description: z
    .string()
    .trim()
    .min(1, "관계형 필드의 연결 의미 설명은 필수입니다.")
    .describe(
      "이 관계형 필드가 타깃 폼과 어떤 비즈니스 의미로 연결되는지 설명하는 1문장 (예: '이 업무를 요청한 담당자를 연결합니다.')"
    ),
});
export type AddRelationFieldInput = z.infer<typeof addRelationFieldInputSchema>;

/**
 * 선택형 필드 옵션 조작 도구(updateFieldOptions) 입력 스키마
 */
export const updateFieldOptionsInputSchema = z.object({
  formId: z
    .uuid("수정 대상 폼의 ID(UUID)는 필수입니다.")
    .describe("옵션을 수정할 대상 폼의 고유 ID"),
  targetFieldId: z
    .string()
    .min(1, "대상 필드 식별자는 필수입니다.")
    .describe("옵션을 수정할 대상 필드의 ID 또는 라벨"),
  operation: z
    .enum(["ADD_OPTIONS", "REMOVE_OPTION", "DISABLE_OPTION", "ENABLE_OPTION", "SET_OPTIONS"])
    .describe(
      "옵션 조작 유형: 'DISABLE_OPTION'(소프트 비활성화 - 과거 데이터 무결성 보존을 위해 삭제 대신 강력 권장), 'ENABLE_OPTION'(비활성화 해제), 'ADD_OPTIONS'(옵션 추가), 'REMOVE_OPTION'(물리 삭제), 'SET_OPTIONS'(전체 옵션 교체)"
    ),
  options: z
    .array(selectOptionSchema)
    .optional()
    .describe("SET_OPTIONS 또는 ADD_OPTIONS 시 추가/교체할 옵션 목록"),
  targetOptionValue: z
    .string()
    .optional()
    .describe(
      "DISABLE_OPTION, ENABLE_OPTION, REMOVE_OPTION 시 조작 대상 옵션의 불변 코드값(value) 또는 표시 라벨(label)"
    ),
});
export type UpdateFieldOptionsInput = z.infer<typeof updateFieldOptionsInputSchema>;

// ==========================================
// 3. 컨슈머 도구 입력 스키마 (Consumer Tools)
// ==========================================

/**
 * 컨슈머 포털 화면 이동 도구(navigate) 입력 스키마
 */
export const consumerNavigateInputSchema = z.object({
  targetPath: z
    .string()
    .describe(
      "이동할 대상 경로 (예: '/consumer/forms', '/consumer/forms/[id]', '/consumer/views')"
    ),
  reason: z.string().describe("사용자에게 안내할 이동 목적 또는 이유"),
});
export type ConsumerNavigateInput = z.infer<typeof consumerNavigateInputSchema>;

/**
 * 컨슈머 폼 필드 자동 채우기 도구(fillFields) 입력 스키마
 */
export const consumerFillFieldsInputSchema = z.object({
  formId: z
    .uuid("폼 ID(UUID)는 필수입니다.")
    .optional()
    .describe("현재 입력 대상 폼의 ID (생략 시 현재 활성 폼)"),
  fields: z
    .record(z.string(), z.unknown())
    .describe("추출된 필드ID-값 쌍 (예: { f_applicant: '홍길동', f_experience: 5 })"),
  message: z.string().describe("필드 입력 후 사용자에게 어떤 내용이 채워졌는지 설명하는 메시지"),
});
export type ConsumerFillFieldsInput = z.infer<typeof consumerFillFieldsInputSchema>;

/**
 * 컨슈머 폼 제출 도구(submitForm) 입력 스키마
 */
export const consumerSubmitFormInputSchema = z.object({
  formId: z
    .uuid("폼 ID(UUID)는 필수입니다.")
    .optional()
    .describe("제출할 대상 폼의 ID (생략 시 현재 활성 폼)"),
  confirmationMessage: z.string().describe("제출 실행 전후 사용자에게 전달할 확인 및 감사 메시지"),
});
export type ConsumerSubmitFormInput = z.infer<typeof consumerSubmitFormInputSchema>;

/**
 * 컨슈머 제출 응답 소프트 삭제 도구(deleteSubmissions) 입력 스키마
 */
export const consumerDeleteSubmissionsInputSchema = z.object({
  submissionIds: z
    .array(z.uuid())
    .min(1, "삭제할 응답 ID는 최소 1개 이상이어야 합니다.")
    .describe("삭제할 제출 응답 ID(UUID) 배열 (단일 응답 삭제 시에도 1개짜리 배열로 전달)"),
  reason: z.string().optional().describe("삭제 사유"),
});
export type ConsumerDeleteSubmissionsInput = z.infer<typeof consumerDeleteSubmissionsInputSchema>;

// ==========================================
// 4. 분석가 도구 입력 스키마 (Analyst Tools)
// ==========================================

/**
 * 신규 분석 뷰 생성 도구(createAnalysisView) 입력 스키마
 */
export const createAnalysisViewInputSchema = z.object({
  title: z
    .string()
    .min(1, "분석 뷰 제목은 필수입니다.")
    .max(255, "분석 뷰 제목은 최대 255자까지 가능합니다.")
    .describe("생성할 분석 뷰 문서의 제목"),
  description: z.string().optional().describe("분석 뷰 문서의 부제목 또는 요약 설명"),
  blocks: z
    .array(analysisBlockSchema)
    .default([])
    .describe("문서를 구성하는 초기 콘텐츠 블록 목록 (text, table, chart)"),
});
export type CreateAnalysisViewInput = z.infer<typeof createAnalysisViewInputSchema>;

/**
 * 분석 뷰 문서 수정 도구(updateAnalysisView) 입력 스키마
 */
export const updateAnalysisViewInputSchema = z.object({
  viewId: z.uuid("수정할 분석 뷰의 고유 ID(UUID)는 필수입니다."),
  operation: analysisViewOperationSchema.describe(
    "수행할 오퍼레이션: ADD_BLOCK, UPDATE_BLOCK, REMOVE_BLOCK, REORDER_BLOCKS, UPDATE_INFO, SET_ALL_BLOCKS"
  ),
  targetBlockId: z
    .string()
    .optional()
    .describe("UPDATE_BLOCK, REMOVE_BLOCK 시 조작 대상 블록의 id"),
  block: analysisBlockSchema
    .optional()
    .describe("ADD_BLOCK 또는 UPDATE_BLOCK 시 추가/교체할 단일 블록 객체"),
  insertIndex: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("ADD_BLOCK 시 삽입할 0-based 위치 인덱스 (생략 시 맨 뒤에 추가)"),
  blockIds: z
    .array(z.string().min(1))
    .optional()
    .describe("REORDER_BLOCKS 시 기존 블록 ID들의 새로운 전체 순서 배열"),
  blocks: z
    .array(analysisBlockSchema)
    .optional()
    .describe("SET_ALL_BLOCKS 시 문서 전체를 교체할 블록 배열"),
  title: z.string().min(1).max(255).optional().describe("UPDATE_INFO 시 변경할 문서 제목"),
  description: z.string().optional().describe("UPDATE_INFO 시 변경할 문서 설명"),
});
export type UpdateAnalysisViewInput = z.infer<typeof updateAnalysisViewInputSchema>;

/**
 * 분석 뷰 발행 토글 도구(publishAnalysisView) 입력 스키마
 */
export const publishAnalysisViewInputSchema = z.object({
  viewId: z.uuid("발행 상태를 변경할 분석 뷰 ID(UUID)는 필수입니다."),
  isPublished: z
    .boolean()
    .default(true)
    .describe("true: 컨슈머 포털에 공식 발행, false: 초안으로 회수"),
});
export type PublishAnalysisViewInput = z.infer<typeof publishAnalysisViewInputSchema>;

/**
 * 분석 뷰 소프트 삭제 도구(deleteAnalysisViews) 입력 스키마
 */
export const deleteAnalysisViewsInputSchema = z.object({
  viewIds: z
    .array(z.uuid("유효한 분석 뷰 UUID가 필요합니다."))
    .min(1, "최소 1개 이상의 분석 뷰 ID가 필요합니다."),
});
export type DeleteAnalysisViewsInput = z.infer<typeof deleteAnalysisViewsInputSchema>;
