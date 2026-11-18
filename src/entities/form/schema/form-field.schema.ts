import { z } from "zod";
import { coreFieldTypeSchema, type CoreFieldType } from "@/shared/schema";
import { validatePrimaryFieldSelection } from "../lib/primary-field";

/**
 * 코어 폼 필드 타입 (9종 순수 도메인 데이터 필드)
 *
 * 단일 진실 원천인 @/shared/schema의 coreFieldTypeSchema를 re-export합니다.
 */
export { coreFieldTypeSchema, type CoreFieldType };

/**
 * 개별 인라인 옵션 Zod 스키마 (소프트 비활성화 지원)
 *
 * 셀렉트, 라디오, 체크박스 필드에서 동일하게 공유하는 표준 보기 규격입니다.
 * 옵션 물리 삭제 대신 disabled: true로 전환하여 과거 데이터의 한글 라벨 무결성을 영구 보존합니다.
 */
export const selectOptionSchema = z.object({
  /** 화면에 표시되는 옵션 라벨 */
  label: z
    .string()
    .min(1, "옵션 라벨은 비어있을 수 없습니다.")
    .describe("화면에 표시되는 옵션 라벨 (예: '높음', '식대')"),
  /** DB에 저장되는 실제 코드/식별값 */
  value: z
    .string()
    .min(1, "옵션 값은 비어있을 수 없습니다.")
    .describe("DB에 저장되는 실제 코드/식별값 (예: 'HIGH', 'MEAL')"),
  /** 해당 옵션의 의미, 선택 기준 및 업무 규칙을 안내하는 필수 설명 (긴 글 허용) */
  description: z
    .string()
    .trim()
    .min(1, "옵션 설명은 필수입니다.")
    .describe("옵션의 구체적인 선택 기준, 적용 조건, 업무 규칙 등을 안내하는 필수 상세 설명"),
  /** 소프트 비활성화 여부 (과거 라벨 보존 및 신규 선택 방지) */
  disabled: z.boolean().default(false).describe("소프트 비활성화 여부 (신규 생성 시 기본값 false)"),
});
export type SelectOption = z.infer<typeof selectOptionSchema>;

/**
 * 관계형 필드(type: "relation") 설정 Zod 스키마
 *
 * 참조할 타깃 도메인 폼과 단일/다중 선택 여부를 규정합니다.
 * 대표 표기 컬럼은 타깃 도메인 폼 자체가 primaryFieldId로 선언하므로 중복 저장하지 않습니다.
 */
export const relationConfigSchema = z.object({
  /** 참조할 대상 폼의 불변 UUID */
  targetFormId: z.uuid("참조 대상 폼 ID는 올바른 UUID 형식이어야 합니다."),
  /** 다중 참조 여부 (기본값: false - 단일 레코드 참조) */
  multiple: z.boolean().default(false),
});
export type RelationConfig = z.infer<typeof relationConfigSchema>;

/**
 * 개별 폼 필드 정의 Zod 스키마
 *
 * AI Navigator가 생성하거나 사용자가 프리뷰/응답하는 폼의 개별 질문/입력 항목의 최소 규격입니다.
 * 필드 식별과 데이터 저장은 오직 불변 id 하나로만 수행되며, 별도의 name 변수명을 요구하지 않습니다.
 */
export const coreFormFieldSchema = z.object({
  /**
   * 필드 고유 식별자이자 데이터 저장 키 (예: "f_project_title")
   */
  id: z.string().min(1, "필드 ID는 비어있을 수 없습니다."),

  /**
   * 화면에 표시되는 필드 대표 라벨이자 엑셀 헤더 매핑 문구 (예: "프로젝트 명칭")
   */
  label: z.string().min(1, "필드 라벨을 입력해 주세요."),

  /**
   * 필드 입력 유형 (9종 순수 데이터 도메인 필드)
   */
  type: coreFieldTypeSchema,

  /**
   * 입력창 플레이스홀더 힌트 문구
   */
  placeholder: z.string().optional(),

  /**
   * 필수 입력 여부 (기본값: false)
   */
  required: z.boolean().default(false),

  /**
   * 정형 선택지 목록 (select, radio, checkbox 전용)
   */
  options: z
    .array(selectOptionSchema)
    .optional()
    .describe(
      "선택형 필드(select, radio, checkbox) 전용 옵션 목록. 반드시 { label, value, disabled } 객체 배열 규격이어야 합니다."
    ),

  /**
   * 관계형 필드 전용 설정 메타데이터 (relation 전용)
   */
  relationConfig: relationConfigSchema.optional(),

  /**
   * 필드의 도메인 의미 및 입력 안내 설명 (필수)
   * 사용자 입력 가이드는 물론 AI 컨텍스트 매핑(특히 relation 필드의 연결 의미 파악)에 활용됩니다.
   */
  description: z
    .string()
    .trim()
    .min(1, "필드 설명은 필수입니다.")
    .describe(
      "필드의 도메인 의미와 입력 기준을 설명하는 1문장. 특히 relation 필드는 타깃 폼과 어떤 의미로 연결되는지 명시해야 합니다."
    ),

  /**
   * 필드 소프트 삭제 일시 (ISO 문자열, 미삭제 시 undefined)
   * 물리 삭제 대신 타임스탬프를 보존하여 과거 제출 데이터의 라벨 및 타입 무결성을 영구 보존합니다.
   */
  deletedAt: z.string().optional(),
});

export type CoreFormField = z.infer<typeof coreFormFieldSchema>;

/**
 * 활성 폼(ActiveForm) 프리뷰 데이터 규격
 *
 * 프리뷰 캔버스에 실시간 렌더링되고 네비게이터가 조작하는 단일 폼의 전체 스냅샷 구조입니다.
 * 슬러그를 배제하고 불변 id와 표시 title을 기준으로 동작합니다.
 */
export const activeFormSchema = z
  .object({
    /**
     * 폼 고유 식별자 (생성 완료 후 발급되는 불변 UUID)
     */
    id: z.uuid().optional(),
    title: z.string().min(1, "폼 제목을 입력해 주세요."),
    description: z.string().optional(),
    /** 이 폼의 각 데이터 행을 대표하는 필수 식별 필드 ID */
    primaryFieldId: z.string().trim().min(1).optional(),
    fields: z.array(coreFormFieldSchema).default([]),
    /**
     * 폼 발행 일시 (미발행/초안 상태 시 null 또는 undefined)
     */
    publishedAt: z.union([z.date(), z.string()]).nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.primaryFieldId !== undefined) {
      const check = validatePrimaryFieldSelection(val.fields, val.primaryFieldId);
      if (!check.isValid) {
        ctx.addIssue({
          code: "custom",
          path: ["primaryFieldId"],
          message: check.reason ?? "유효하지 않은 대표 필드 지정입니다.",
        });
      }
    }
  });

export type ActiveForm = z.infer<typeof activeFormSchema>;
