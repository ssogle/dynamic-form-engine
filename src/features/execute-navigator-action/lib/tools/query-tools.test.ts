import { describe, it, expect, vi } from "vitest";
import type { Form } from "@/entities/form";
import { createQueryTools } from "./query-tools";

describe("createQueryTools (features/execute-navigator-action/lib/tools)", () => {
  const mockForms: Form[] = [
    {
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      title: "일일 업무 보고서",
      description: "매일 업무 내용을 등록합니다.",
      schemaDefinition: {
        fields: [
          {
            id: "f1",
            label: "작성자",
            type: "text",
            required: true,
            description: "보고서 작성자 성명을 입력합니다.",
          },
          {
            id: "f2",
            label: "업무 내용",
            type: "textarea",
            required: true,
            description: "금일 진행한 주요 업무 내용을 서술합니다.",
          },
        ],
      },
      publishedAt: new Date("2026-11-01T00:00:00Z"),
      version: 1,
      createdAt: new Date("2026-11-01T00:00:00Z"),
      updatedAt: new Date("2026-11-01T00:00:00Z"),
      deletedAt: null,
    },
    {
      id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
      title: "신규 프로젝트 채용",
      description: "프로젝트 투입 인원 모집",
      schemaDefinition: {
        fields: [
          {
            id: "f3",
            label: "지원자명",
            type: "text",
            required: true,
            description: "채용 지원자의 이름을 입력합니다.",
          },
          {
            id: "f4",
            label: "경력",
            type: "number",
            required: false,
            description: "관련 직무 경력 연수를 숫자로 입력합니다.",
          },
        ],
      },
      publishedAt: null, // 미발행
      version: 1,
      createdAt: new Date("2026-11-02T00:00:00Z"),
      updatedAt: new Date("2026-11-02T00:00:00Z"),
      deletedAt: null,
    },
  ];

  const dependencies = {
    findActiveForms: vi.fn().mockResolvedValue(mockForms),
    findPublishedForms: vi.fn().mockResolvedValue([mockForms[0]]),
    findFormById: vi.fn().mockImplementation(async (id: string) => {
      return mockForms.find((f) => f.id === id);
    }),
  };

  const mockExecutionOptions = {
    toolCallId: "test-call-id",
    messages: [],
    context: {},
  } as unknown as Parameters<
    NonNullable<ReturnType<typeof createQueryTools>["searchForms"]["execute"]>
  >[1];

  it("searchForms: 키워드 없이 컨슈머 모드로 호출 시 발행된 폼의 경량 메타데이터만 반환해야 한다", async () => {
    const tools = createQueryTools(dependencies);
    const result = (await tools.searchForms.execute!(
      { mode: "consumer" },
      mockExecutionOptions
    )) as Array<{
      id: string;
      title: string;
      description?: string;
      isPublished: boolean;
    }>;

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      title: "일일 업무 보고서",
      description: "매일 업무 내용을 등록합니다.",
      isPublished: true,
    });
    // 무거운 schemaDefinition 필드는 포함되지 않음
    expect((result[0] as unknown as Form).schemaDefinition).toBeUndefined();
  });

  it("searchForms: 빌더 모드로 호출 시 미발행 폼을 포함한 전체 활성 폼을 반환해야 한다", async () => {
    const tools = createQueryTools(dependencies);
    const result = (await tools.searchForms.execute!(
      { mode: "builder" },
      mockExecutionOptions
    )) as Array<{
      id: string;
      title: string;
      description?: string;
      isPublished: boolean;
    }>;

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual([
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
    ]);
  });

  it("searchForms: 키워드 전달 시 제목/설명에서 대소문자 무시하고 필터링해야 한다", async () => {
    const tools = createQueryTools(dependencies);
    const result = (await tools.searchForms.execute!(
      { keyword: "채용", mode: "builder" },
      mockExecutionOptions
    )) as Array<{
      id: string;
      title: string;
      description?: string;
      isPublished: boolean;
    }>;

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22");
  });

  it("getFormDetails: 존재하는 ID 조회 시 세부 필드 규격을 반환해야 한다", async () => {
    const tools = createQueryTools(dependencies);
    const result = (await tools.getFormDetails.execute!(
      { formId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
      mockExecutionOptions
    )) as {
      found: boolean;
      id?: string;
      title?: string;
      fields?: Array<{ id: string; label: string; type: string; required: boolean }>;
    };

    expect(result.found).toBe(true);
    expect(result.id).toBe("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    expect(result.fields).toHaveLength(2);
    expect(result.fields?.[0]).toEqual({
      id: "f1",
      label: "작성자",
      type: "text",
      required: true,
      options: undefined,
      capabilities: {
        filterOperators: ["contains", "eq", "neq", "isEmpty", "isNotEmpty"],
        aggregatableMetrics: ["count"],
        groupable: true,
        isDateAxisCandidate: false,
      },
    });
  });

  it("getFormDetails: 존재하지 않는 ID 조회 시 found: false를 반환해야 한다", async () => {
    const tools = createQueryTools(dependencies);
    const result = (await tools.getFormDetails.execute!(
      { formId: "00000000-0000-0000-0000-000000000000" },
      mockExecutionOptions
    )) as { found: boolean; message?: string };

    expect(result.found).toBe(false);
    expect(result.message).toContain("00000000-0000-0000-0000-000000000000");
  });

  it("getRelatedSubmissions: relations 엣지 역참조 그룹을 포맷팅하여 반환해야 한다", async () => {
    const tools = createQueryTools({
      ...dependencies,
      findInboundRelatedSubmissions: vi.fn().mockResolvedValue([
        {
          sourceForm: {
            id: "form-expense",
            title: "비용 정산",
            schemaDefinition: {
              primaryFieldId: "f_item",
              fields: [
                {
                  id: "f_item",
                  label: "지출 항목",
                  type: "text",
                  required: true,
                  description: "항목",
                },
                {
                  id: "f_amount",
                  label: "금액",
                  type: "number",
                  required: true,
                  description: "금액",
                },
              ],
            },
          },
          submissions: [
            {
              id: "sub-exp-1",
              formId: "form-expense",
              version: 1,
              data: { f_item: "팀 회식", f_amount: 120000 },
              createdAt: new Date("2026-11-01T00:00:00Z"),
              updatedAt: new Date("2026-11-01T00:00:00Z"),
              deletedAt: null,
            },
          ],
        },
      ]),
    });

    const result = (await tools.getRelatedSubmissions.execute!(
      { submissionId: "11111111-1111-4111-a111-111111111111" },
      mockExecutionOptions
    )) as {
      found: boolean;
      totalGroups: number;
      totalRelatedCount: number;
      groups: Array<{
        sourceFormTitle: string;
        items: Array<{ primaryValue: string; values: Record<string, string> }>;
      }>;
    };

    expect(result.found).toBe(true);
    expect(result.totalGroups).toBe(1);
    expect(result.totalRelatedCount).toBe(1);
    expect(result.groups[0]?.sourceFormTitle).toBe("비용 정산");
    expect(result.groups[0]?.items[0]?.primaryValue).toBe("팀 회식");
    expect(result.groups[0]?.items[0]?.values).toEqual({
      "지출 항목": "팀 회식",
      금액: "120000",
    });
  });
});
