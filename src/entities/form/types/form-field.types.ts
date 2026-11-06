import { z } from "zod";

/**
 * 1단계 코어 폼 필드 타입 (지원 필드 4종)
 *
 * - text: 단문 텍스트 입력
 * - textarea: 장문 설명 입력
 * - number: 숫자 입력
 * - select: 단일 선택 드롭다운
 */
export const coreFieldTypeSchema = z.enum(["text", "textarea", "number", "select"]);
export type CoreFieldType = z.infer<typeof coreFieldTypeSchema>;

/**
 * 개별 폼 필드 정의 Zod 스키마
 *
 * AI Navigator가 생성하거나 사용자가 프리뷰하는 폼의 개별 질문/입력 항목의 최소 규격입니다.
 */
export const coreFormFieldSchema = z.object({
  /**
   * 필드 고유 식별자 (예: "field_project_name")
   */
  id: z.string().min(1, "필드 ID는 비어있을 수 없습니다."),

  /**
   * 데이터 저장 및 바인딩 키값 (예: "projectName")
   */
  name: z.string().min(1, "필드 식별 키값은 필수입니다."),

  /**
   * 화면에 표시되는 필드 대표 라벨 (예: "프로젝트 명칭")
   */
  label: z.string().min(1, "필드 라벨을 입력해 주세요."),

  /**
   * 필드 입력 유형 (text | textarea | number | select)
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
   * 선택형 필드(select) 전용 선택지 목록
   */
  options: z.array(z.string()).optional(),

  /**
   * 필드 하단에 표시되는 부가 설명 문구
   */
  description: z.string().optional(),
});

export type CoreFormField = z.infer<typeof coreFormFieldSchema>;

/**
 * 활성 폼(ActiveForm) 프리뷰 데이터 규격
 *
 * 프리뷰 캔버스에 실시간 렌더링되고 네비게이터가 조작하는 단일 폼의 전체 스냅샷 구조입니다.
 */
export const activeFormSchema = z.object({
  slug: z
    .string()
    .min(2, "폼 슬러그는 최소 2글자 이상이어야 합니다.")
    .regex(/^[a-z0-9-]+$/, "슬러그는 영문 소문자, 숫자, 하이픈만 허용됩니다."),
  title: z.string().min(1, "폼 제목을 입력해 주세요."),
  description: z.string().optional(),
  fields: z.array(coreFormFieldSchema).default([]),
});

export type ActiveForm = z.infer<typeof activeFormSchema>;
