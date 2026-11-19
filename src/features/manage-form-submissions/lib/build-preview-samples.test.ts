import { describe, it, expect } from "vitest";
import type { CoreFormField, Form } from "@/entities/form";
import { buildPreviewSampleSubmissions } from "./build-preview-samples";

function createTestForm(fields: CoreFormField[]): Form {
  return {
    id: "form-uuid-preview",
    title: "샘플 미리보기 테스트 폼",
    description: "테스트용 설명",
    schemaDefinition: {
      version: "1.0",
      primaryFieldId: fields[0]?.id ?? "f_text",
      fields,
    },
    publishedAt: null,
    version: 1,
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    updatedAt: new Date("2026-11-01T00:00:00.000Z"),
    deletedAt: null,
  };
}

describe("buildPreviewSampleSubmissions (features/manage-form-submissions/lib)", () => {
  it("활성 필드가 없으면 빈 배열을 반환해야 한다", () => {
    const form = createTestForm([
      {
        id: "f_deleted",
        label: "삭제된 필드",
        type: "text",
        required: false,
        description: "소프트 삭제됨",
        deletedAt: "2026-11-02T00:00:00.000Z",
      },
    ]);

    expect(buildPreviewSampleSubmissions(form)).toEqual([]);
  });

  it("9종 코어 필드 타입에 맞는 결정론적 샘플 응답 레코드 3건을 생성해야 한다", () => {
    const form = createTestForm([
      { id: "f_text", label: "항목명", type: "text", required: true, description: "명칭" },
      {
        id: "f_textarea",
        label: "상세 설명",
        type: "textarea",
        required: false,
        description: "설명",
      },
      { id: "f_num", label: "금액", type: "number", required: true, description: "금액" },
      { id: "f_date", label: "기준일", type: "date", required: true, description: "날짜" },
      {
        id: "f_switch",
        label: "승인 여부",
        type: "switch",
        required: false,
        description: "토글",
      },
      {
        id: "f_select",
        label: "상태",
        type: "select",
        required: true,
        description: "상태 선택",
        options: [
          { label: "비활성 상태", value: "OLD", description: "사용 중지", disabled: true },
          { label: "진행 중", value: "ACTIVE", description: "활성 상태", disabled: false },
          { label: "완료", value: "DONE", description: "완료 상태", disabled: false },
        ],
      },
      {
        id: "f_radio",
        label: "우선순위",
        type: "radio",
        required: true,
        description: "우선순위",
        options: [
          { label: "높음", value: "HIGH", description: "긴급", disabled: false },
          { label: "보통", value: "NORMAL", description: "일반", disabled: false },
        ],
      },
      {
        id: "f_checkbox_multi",
        label: "태그",
        type: "checkbox",
        required: false,
        description: "다중 태그",
        options: [
          { label: "프론트엔드", value: "FE", description: "FE", disabled: false },
          { label: "백엔드", value: "BE", description: "BE", disabled: false },
        ],
      },
      {
        id: "f_checkbox_bool",
        label: "동의 여부",
        type: "checkbox",
        required: false,
        description: "단일 체크",
      },
      {
        id: "f_rel_single",
        label: "담당자",
        type: "relation",
        required: false,
        description: "단일 참조",
        relationConfig: { targetFormId: "11111111-1111-4111-8111-111111111111", multiple: false },
      },
      {
        id: "f_rel_multi",
        label: "참조 프로젝트",
        type: "relation",
        required: false,
        description: "다중 참조",
        relationConfig: { targetFormId: "22222222-2222-4222-8222-222222222222", multiple: true },
      },
    ]);

    const samples = buildPreviewSampleSubmissions(form);
    expect(samples).toHaveLength(3);

    const first = samples[0]!;
    const second = samples[1]!;

    expect(first.id).toBe("sample-preview-1");
    expect(first.formId).toBe("form-uuid-preview");
    expect(first.deletedAt).toBeNull();
    expect(first.data).toMatchObject({
      f_text: "항목명 예시 1",
      f_textarea: "상세 설명에 대한 샘플 상세 내용입니다. (1번째 예시)",
      f_num: 100,
      f_date: "2026-11-18",
      f_switch: true,
      // 비활성 옵션("OLD")을 건너뛰고 활성 옵션만 순환해야 함 (단일 select도 string[] 포맷)
      f_select: ["ACTIVE"],
      f_radio: "HIGH",
      f_checkbox_multi: ["FE"],
      f_checkbox_bool: true,
      f_rel_single: ["샘플 참조 레코드 1"],
      f_rel_multi: ["샘플 참조 레코드 1-A", "샘플 참조 레코드 1-B"],
    });

    expect(second.data).toMatchObject({
      f_select: ["DONE"],
      f_radio: "NORMAL",
      f_checkbox_multi: ["FE", "BE"],
      f_checkbox_bool: false,
    });
  });

  it("count가 0 이하이면 빈 배열을 반환해야 한다", () => {
    const form = createTestForm([
      { id: "f_text", label: "항목명", type: "text", required: true, description: "명칭" },
    ]);

    expect(buildPreviewSampleSubmissions(form, 0)).toEqual([]);
  });
});
