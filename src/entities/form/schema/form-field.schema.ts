import { z } from "zod";

/**
 * 코어 폼 필드 타입 (8종 입력 필드 + 1종 레이아웃 요소)
 *
 * - text: 단문 텍스트 입력
 * - textarea: 장문 설명 입력
 * - number: 숫자 입력
 * - select: 단일 선택 드롭다운
 * - radio: 라디오 버튼 단일 선택 그룹
 * - checkbox: 다중 선택 체크박스 그룹
 * - date: 순수 달력 날짜 선택기 (YYYY-MM-DD)
 * - switch: 참/거짓 모던 토글 스위치 (boolean)
 * - relation: 타겟 데이터 도메인(타 폼 서브미션) 검색/선택 콤보박스
 * - section: 서식 구획 구분선 및 섹션 안내 제목 레이아웃 블록
 */
export const coreFieldTypeSchema = z.enum([
  "text",
  "textarea",
  "number",
  "select",
  "radio",
  "checkbox",
  "date",
  "switch",
  "relation",
  "section",
]);
export type CoreFieldType = z.infer<typeof coreFieldTypeSchema>;

/**
 * 개별 인라인 옵션 Zod 스키마 (소프트 비활성화 지원)
 *
 * 셀렉트, 라디오, 체크박스 필드에서 동일하게 공유하는 표준 보기 규격입니다.
 * 옵션 물리 삭제 대신 disabled: true로 전환하여 과거 데이터의 한글 라벨 무결성을 영구 보존합니다.
 */
export const selectOptionSchema = z.object({
  /** 화면에 표시되는 옵션 라벨 */
  label: z.string().min(1, "옵션 라벨은 비어있을 수 없습니다."),
  /** DB에 저장되는 실제 코드/식별값 */
  value: z.string().min(1, "옵션 값은 비어있을 수 없습니다."),
  /** 소프트 비활성화 여부 (과거 라벨 보존 및 신규 선택 방지) */
  disabled: z.boolean().default(false),
});
export type SelectOption = z.infer<typeof selectOptionSchema>;

/**
 * 하위 호환성을 지원하는 정규화 옵션 입력 스키마
 *
 * 과거 레거시 문자열 배열(["신규", "유지보수"])이 유입되더라도
 * 자동으로 [{ label: "신규", value: "신규", disabled: false }, ...] 형태의
 * 객체 배열로 안전하게 자동 변환(transform)합니다.
 */
export const selectOptionsInputSchema = z.array(
  z.union([
    selectOptionSchema,
    z.string().transform((str) => ({
      label: str,
      value: str,
      disabled: false,
    })),
  ])
);

/**
 * 관계형 필드(type: "relation") 설정 Zod 스키마
 *
 * 타겟 도메인 폼과 대표 노출 필드, 단일/다중 선택 여부를 규정합니다.
 */
export const relationConfigSchema = z.object({
  /** 참조할 대상 폼의 불변 UUID */
  targetFormId: z.uuid("참조 대상 폼 ID는 올바른 UUID 형식이어야 합니다."),
  /** 콤보박스 선택지 목록에 노출할 대상 폼의 대표 필드 ID (예: 'f_project_name') */
  displayField: z.string().min(1, "대표 노출 필드 ID는 비어있을 수 없습니다."),
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
   * 필드 입력 유형 (8종 입력 + 1종 레이아웃)
   */
  type: coreFieldTypeSchema,

  /**
   * 입력창 플레이스홀더 힌트 문구
   */
  placeholder: z.string().optional(),

  /**
   * 필수 입력 여부 (기본값: false, section 레이아웃은 무관)
   */
  required: z.boolean().default(false),

  /**
   * 정형 선택지 목록 (select, radio, checkbox 전용)
   */
  options: selectOptionsInputSchema.optional(),

  /**
   * 관계형 필드 전용 설정 메타데이터 (relation 전용)
   */
  relationConfig: relationConfigSchema.optional(),

  /**
   * 필드 하단에 표시되는 부가 설명 문구
   */
  description: z.string().optional(),

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
export const activeFormSchema = z.object({
  /**
   * 폼 고유 식별자 (생성 완료 후 발급되는 불변 UUID)
   */
  id: z.uuid().optional(),
  title: z.string().min(1, "폼 제목을 입력해 주세요."),
  description: z.string().optional(),
  fields: z.array(coreFormFieldSchema).default([]),
  /**
   * 폼 발행 일시 (미발행/초안 상태 시 null 또는 undefined)
   */
  publishedAt: z.union([z.date(), z.string()]).nullable().optional(),
});

export type ActiveForm = z.infer<typeof activeFormSchema>;
