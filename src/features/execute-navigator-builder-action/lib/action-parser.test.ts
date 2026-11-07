import { describe, expect, it } from "vitest";
import { parseNavigatorAction, sanitizeSlug } from "./action-parser";

describe("action-parser (AI 액션 파서)", () => {
  describe("sanitizeSlug", () => {
    it("대문자, 공백, 특수문자를 안전한 kebab-case로 치환해야 한다", () => {
      expect(sanitizeSlug("My New Project Form!")).toBe("my-new-project-form");
      expect(sanitizeSlug("   CUSTOMER_FEEDBACK_2026   ")).toBe("customer-feedback-2026");
    });

    it("빈 문자열이거나 유효 문자가 없을 경우 기본 슬러그를 반환해야 한다", () => {
      expect(sanitizeSlug("")).toBe("form-preview");
      expect(sanitizeSlug("!!!@@@###")).toBe("form-preview");
    });
  });

  describe("parseNavigatorAction", () => {
    it("올바른 NAVIGATE 액션을 성공적으로 파싱해야 한다", () => {
      const raw = {
        type: "NAVIGATE",
        targetPath: "/builder/test-survey",
        message: "테스트 설문 페이지로 이동합니다.",
      };

      const result = parseNavigatorAction(raw);
      expect(result.error).toBeNull();
      expect(result.data).toEqual(raw);
    });

    it("올바른 CREATE_FORM 액션을 파싱하고 비정형 슬러그를 자동 정규화해야 한다", () => {
      const raw = {
        type: "CREATE_FORM",
        slug: "Event Registration 2026",
        title: "2026 컨퍼런스 등록",
        fields: [
          {
            id: "f_name",
            name: "userName",
            label: "참가자 성명",
            type: "text",
            required: true,
          },
        ],
        message: "컨퍼런스 등록 폼을 생성했습니다.",
      };

      const result = parseNavigatorAction(raw);
      expect(result.error).toBeNull();
      expect(result.data?.type).toBe("CREATE_FORM");
      if (result.data?.type === "CREATE_FORM") {
        expect(result.data.slug).toBe("event-registration-2026");
        expect(result.data.fields.length).toBe(1);
      }
    });

    it("올바른 UPDATE_SCHEMA 액션을 성공적으로 파싱해야 한다", () => {
      const raw = {
        type: "UPDATE_SCHEMA",
        formSlug: "event-registration",
        operation: "ADD_FIELD",
        fieldData: {
          id: "f_phone",
          name: "phoneNumber",
          label: "연락처",
          type: "text",
          required: false,
        },
        message: "연락처 필드를 추가했습니다.",
      };

      const result = parseNavigatorAction(raw);
      expect(result.error).toBeNull();
      expect(result.data?.type).toBe("UPDATE_SCHEMA");
    });

    it("유효하지 않은 객체나 타입일 경우 에러 Result를 반환해야 한다", () => {
      const resultNull = parseNavigatorAction(null);
      expect(resultNull.data).toBeNull();
      expect(resultNull.error?.code).toBe("INVALID_ACTION_PAYLOAD");

      const resultInvalidType = parseNavigatorAction({
        type: "UNKNOWN_ACTION",
        message: "알 수 없는 액션",
      });
      expect(resultInvalidType.data).toBeNull();
      expect(resultInvalidType.error?.code).toBe("ACTION_SCHEMA_VALIDATION_ERROR");
    });

    it("필수 프로퍼티가 누락된 경우 에러 Result를 반환해야 한다", () => {
      const missingTitle = {
        type: "CREATE_FORM",
        slug: "valid-slug",
        // title 누락
        fields: [],
        message: "생성 시도",
      };

      const result = parseNavigatorAction(missingTitle);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("ACTION_SCHEMA_VALIDATION_ERROR");
    });
  });
});
