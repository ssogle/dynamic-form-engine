import { describe, expect, it } from "vitest";
import { navigatorRequestSchema } from "./navigator-request.schema";

describe("Navigator Request Schema Validation (src/features/execute-navigator-action/schema/navigator-request.schema.ts)", () => {
  describe("기본값 및 필수 속성(prompt, mode) 검증", () => {
    it("최소 필수 속성인 prompt만 전달되어도 검증을 통과하고 mode 기본값 'builder'를 할당해야 한다", () => {
      const payload = {
        prompt: "새로운 고객 설문 폼을 만들어줘",
      };

      const result = navigatorRequestSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.prompt).toBe("새로운 고객 설문 폼을 만들어줘");
        expect(result.data.mode).toBe("builder");
        expect(result.data.messages).toBeUndefined();
        expect(result.data.currentContext).toBeUndefined();
      }
    });

    it("prompt가 빈 문자열이거나 누락된 경우 유효성 검사에 실패해야 한다", () => {
      const missingPrompt = {};
      const emptyPrompt = { prompt: "" };

      expect(navigatorRequestSchema.safeParse(missingPrompt).success).toBe(false);

      const emptyResult = navigatorRequestSchema.safeParse(emptyPrompt);
      expect(emptyResult.success).toBe(false);
      if (!emptyResult.success) {
        expect(emptyResult.error.issues[0]?.message).toBe("사용자 명령 프롬프트는 필수입니다.");
      }
    });

    it("mode에 올바른 열거형 값('builder', 'consumer', 'analyst')이 주어지면 정상 파싱해야 한다", () => {
      const builderResult = navigatorRequestSchema.safeParse({
        mode: "builder",
        prompt: "폼 빌더 명령",
      });
      const consumerResult = navigatorRequestSchema.safeParse({
        mode: "consumer",
        prompt: "컨슈머 응답 명령",
      });
      const analystResult = navigatorRequestSchema.safeParse({
        mode: "analyst",
        prompt: "분석 뷰 생성 명령",
      });

      expect(builderResult.success).toBe(true);
      expect(consumerResult.success).toBe(true);
      expect(analystResult.success).toBe(true);
    });

    it("mode에 지원하지 않는 잘못된 값이 전달되면 파싱에 실패해야 한다", () => {
      const invalidMode = {
        mode: "admin",
        prompt: "관리자 명령",
      };

      const result = navigatorRequestSchema.safeParse(invalidMode);
      expect(result.success).toBe(false);
    });
  });

  describe("messages (대화 세션 히스토리 검증)", () => {
    it("올바른 role(user, assistant, system)과 content를 가진 메시지 목록을 정상 파싱해야 한다", () => {
      const payload = {
        prompt: "다음 질문도 추가해줘",
        messages: [
          { role: "system", content: "당신은 AI 어시스턴트입니다." },
          { role: "user", content: "이름 입력 필드 추가해줘" },
          { role: "assistant", content: "이름 필드를 추가했습니다." },
        ],
      };

      const result = navigatorRequestSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.messages).toHaveLength(3);
        expect(result.data.messages?.[0]?.role).toBe("system");
      }
    });

    it("지원하지 않는 role이 포함된 경우 파싱에 실패해야 한다", () => {
      const payload = {
        prompt: "명령",
        messages: [{ role: "developer", content: "잘못된 역할" }],
      };

      const result = navigatorRequestSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("currentContext (Builder 화면 맥락 검증)", () => {
    it("빌더 활성 폼 정보(currentForm)와 가시 폼 캐시 목록(visibleForms)을 정상 파싱해야 한다", () => {
      const payload = {
        mode: "builder",
        prompt: "현재 폼에 전화번호 필드 추가해줘",
        currentContext: {
          currentPath: "/builder/forms/form-uuid-1",
          currentForm: {
            id: "form-uuid-1",
            title: "입사 지원서",
            description: "개발팀 채용 폼",
            isPublished: true,
            primaryFieldId: "f_name",
            fields: [
              {
                id: "f_name",
                label: "이름",
                type: "text",
                required: true,
                description: "지원자의 성명을 입력합니다.",
              },
            ],
          },
          visibleForms: [
            {
              id: "form-uuid-1",
              title: "입사 지원서",
              createdAt: "2026-11-10T00:00:00.000Z",
              summary: "개발팀 채용 폼",
            },
          ],
        },
      };

      const result = navigatorRequestSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currentContext?.currentForm?.id).toBe("form-uuid-1");
        expect(result.data.currentContext?.currentForm?.isPublished).toBe(true);
        expect(result.data.currentContext?.currentForm?.primaryFieldId).toBe("f_name");
        expect(result.data.currentContext?.currentForm?.fields).toHaveLength(1);
        expect(result.data.currentContext?.visibleForms).toHaveLength(1);
      }
    });

    it("currentForm의 fields가 생략된 경우 기본값 빈 배열([])을 할당해야 한다", () => {
      const payload = {
        mode: "builder",
        prompt: "새 폼 수정",
        currentContext: {
          currentForm: {
            id: "form-uuid-2",
            title: "제목만 있는 폼",
          },
        },
      };

      const result = navigatorRequestSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currentContext?.currentForm?.fields).toEqual([]);
      }
    });
  });

  describe("currentContext (Consumer 화면 맥락 검증)", () => {
    it("컨슈머 화면 맥락(currentFormId, availableFields, currentDraftValues, visibleSubmissions)을 정상 파싱해야 한다", () => {
      const payload = {
        mode: "consumer",
        prompt: "내 이름은 홍길동이야",
        currentContext: {
          currentPath: "/consumer/forms/form-uuid-1",
          currentFormId: "form-uuid-1",
          currentFormTitle: "입사 지원서",
          availableFields: [
            {
              id: "f_name",
              label: "이름",
              type: "text",
              required: true,
              description: "지원자의 성명을 입력합니다.",
            },
            {
              id: "f_role",
              label: "희망 직무",
              type: "select",
              required: false,
              description: "지원하려는 직무를 선택합니다.",
              options: [
                {
                  label: "프론트엔드",
                  value: "Frontend",
                  description: "웹 UI 및 클라이언트 상태 관리를 담당하는 직무입니다.",
                  disabled: false,
                },
                {
                  label: "백엔드",
                  value: "Backend",
                  description: "API 서버 및 데이터베이스 설계를 담당하는 직무입니다.",
                  disabled: false,
                },
              ],
            },
          ],
          currentDraftValues: {
            f_name: "홍길동",
            f_role: "Frontend",
          },
          visibleSubmissions: [
            {
              id: "sub-1",
              title: "응답 #1 (홍길동)",
              createdAt: "2026-11-10T00:00:00.000Z",
              summary: "이름: 홍길동",
            },
          ],
        },
      };

      const result = navigatorRequestSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currentContext?.currentFormId).toBe("form-uuid-1");
        expect(result.data.currentContext?.availableFields).toHaveLength(2);
        expect(result.data.currentContext?.currentDraftValues).toEqual({
          f_name: "홍길동",
          f_role: "Frontend",
        });
        expect(result.data.currentContext?.visibleSubmissions).toHaveLength(1);
      }
    });

    it("visibleItemSchema의 id 또는 title이 누락되면 파싱에 실패해야 한다", () => {
      const payloadMissingId = {
        prompt: "목록 조회",
        currentContext: {
          visibleForms: [{ title: "제목만 있음" }],
        },
      };

      const payloadMissingTitle = {
        prompt: "목록 조회",
        currentContext: {
          visibleForms: [{ id: "uuid-1" }],
        },
      };

      expect(navigatorRequestSchema.safeParse(payloadMissingId).success).toBe(false);
      expect(navigatorRequestSchema.safeParse(payloadMissingTitle).success).toBe(false);
    });

    it("availableFields의 options에 단순 문자열 배열이 유입되면 파싱에 실패해야 한다", () => {
      const payload = {
        mode: "consumer",
        prompt: "테스트",
        currentContext: {
          availableFields: [
            {
              id: "f_role",
              label: "희망 직무",
              type: "select",
              options: ["Frontend", "Backend"],
            },
          ],
        },
      };

      expect(navigatorRequestSchema.safeParse(payload).success).toBe(false);
    });
  });

  describe("currentContext (Analyst 화면 맥락 검증)", () => {
    it("분석가 활성 분석 뷰(currentAnalysisView)와 목록 캐시(visibleAnalysisViews)를 정상 파싱해야 한다", () => {
      const payload = {
        mode: "analyst",
        prompt: "이 문서 맨 아래에 텍스트 요약을 추가해줘",
        currentContext: {
          currentPath: "/analyst/views/view-uuid-1",
          currentAnalysisView: {
            id: "view-uuid-1",
            title: "2월 만족도 리포트",
            description: "요약",
            isPublished: false,
            blocks: [
              {
                id: "block-1",
                type: "text",
                title: "개요",
                content: "핵심 지표 분석입니다.",
              },
            ],
          },
          visibleAnalysisViews: [{ id: "view-uuid-1", title: "2월 만족도 리포트" }],
        },
      };

      const result = navigatorRequestSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currentContext?.currentAnalysisView?.blocks).toHaveLength(1);
        expect(result.data.currentContext?.visibleAnalysisViews).toHaveLength(1);
      }
    });

    it("currentAnalysisView.blocks에 유효하지 않은 블록 타입이 포함되면 실패해야 한다", () => {
      const payload = {
        mode: "analyst",
        prompt: "차트 수정",
        currentContext: {
          currentAnalysisView: {
            id: "view-uuid-1",
            title: "잘못된 리포트",
            blocks: [{ id: "b1", type: "video", url: "https://example.com" }],
          },
        },
      };

      expect(navigatorRequestSchema.safeParse(payload).success).toBe(false);
    });
  });

  describe("attachments (멀티모달 이미지 첨부 검증) 및 confirmedAction 검증", () => {
    it("최대 3장의 유효한 PNG/JPEG/WEBP 이미지 첨부는 정상 파싱해야 한다", () => {
      const payload = {
        mode: "consumer",
        prompt: "영수증 내용을 입력해줘",
        attachments: [
          { name: "receipt.png", mimeType: "image/png", dataUrl: "data:image/png;base64,AAA" },
          { name: "slip.webp", mimeType: "image/webp", dataUrl: "data:image/webp;base64,BBB" },
        ],
      };

      const parsed = navigatorRequestSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.attachments).toHaveLength(2);
      }
    });

    it("이미지를 4장 이상 첨부하거나 비허용 MIME/DataURL이면 파싱에 실패해야 한다", () => {
      const tooMany = navigatorRequestSchema.safeParse({
        prompt: "첨부 초과",
        attachments: Array.from({ length: 4 }, (_, i) => ({
          name: `img-${i}.png`,
          mimeType: "image/png",
          dataUrl: "data:image/png;base64,AAA",
        })),
      });
      const invalidMime = navigatorRequestSchema.safeParse({
        prompt: "잘못된 형식",
        attachments: [{ mimeType: "application/pdf", dataUrl: "data:image/png;base64,AAA" }],
      });

      expect(tooMany.success).toBe(false);
      expect(invalidMime.success).toBe(false);
    });

    it("고위험 액션 승인 실행(confirmedAction) 페이로드를 정상 파싱해야 한다", () => {
      const parsed = navigatorRequestSchema.safeParse({
        mode: "builder",
        prompt: "[승인] 폼 발행",
        confirmedAction: {
          confirmationId: "conf-1",
          toolName: "publishForm",
          payload: { formId: "form-uuid-1", isPublished: true },
        },
      });

      expect(parsed.success).toBe(true);
    });
  });
});
