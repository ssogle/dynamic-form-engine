import { describe, it, expect, vi } from "vitest";
import type { Form } from "@/entities/form";
import { createQueryTools } from "./query-tools";

describe("createQueryTools (features/execute-navigator-action/lib/tools)", () => {
  const mockForms: Form[] = [
    {
      id: "form-1",
      slug: "daily-report",
      title: "일일 업무 보고서",
      description: "매일 업무 내용을 등록합니다.",
      schemaDefinition: {
        fields: [
          { id: "f1", name: "author", label: "작성자", type: "text", required: true },
          { id: "f2", name: "tasks", label: "업무 내용", type: "textarea", required: true },
        ],
      },
      publishedAt: new Date("2026-11-01T00:00:00Z"),
      createdAt: new Date("2026-11-01T00:00:00Z"),
      updatedAt: new Date("2026-11-01T00:00:00Z"),
      deletedAt: null,
    },
    {
      id: "form-2",
      slug: "project-hire",
      title: "신규 프로젝트 채용",
      description: "프로젝트 투입 인원 모집",
      schemaDefinition: {
        fields: [
          { id: "f3", name: "applicant", label: "지원자명", type: "text", required: true },
          { id: "f4", name: "years", label: "경력", type: "number", required: false },
        ],
      },
      publishedAt: null, // 미발행
      createdAt: new Date("2026-11-02T00:00:00Z"),
      updatedAt: new Date("2026-11-02T00:00:00Z"),
      deletedAt: null,
    },
  ];

  const dependencies = {
    findActiveForms: vi.fn().mockResolvedValue(mockForms),
    findPublishedForms: vi.fn().mockResolvedValue([mockForms[0]]),
    findFormBySlug: vi.fn().mockImplementation(async (slug: string) => {
      return mockForms.find((f) => f.slug === slug);
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
      slug: string;
      title: string;
      description?: string;
      isPublished: boolean;
    }>;

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "form-1",
      slug: "daily-report",
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
      slug: string;
      title: string;
      description?: string;
      isPublished: boolean;
    }>;

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.slug)).toEqual(["daily-report", "project-hire"]);
  });

  it("searchForms: 키워드 전달 시 제목/슬러그/설명에서 대소문자 무시하고 필터링해야 한다", async () => {
    const tools = createQueryTools(dependencies);
    const result = (await tools.searchForms.execute!(
      { keyword: "채용", mode: "builder" },
      mockExecutionOptions
    )) as Array<{
      id: string;
      slug: string;
      title: string;
      description?: string;
      isPublished: boolean;
    }>;

    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe("project-hire");
  });

  it("getFormDetails: 존재하는 슬러그 조회 시 세부 필드 규격을 반환해야 한다", async () => {
    const tools = createQueryTools(dependencies);
    const result = (await tools.getFormDetails.execute!(
      { formSlug: "daily-report" },
      mockExecutionOptions
    )) as {
      found: boolean;
      slug?: string;
      fields?: Array<{ id: string; name: string; label: string; type: string; required: boolean }>;
    };

    expect(result.found).toBe(true);
    expect(result.slug).toBe("daily-report");
    expect(result.fields).toHaveLength(2);
    expect(result.fields?.[0]).toEqual({
      id: "f1",
      name: "author",
      label: "작성자",
      type: "text",
      required: true,
      options: undefined,
    });
  });

  it("getFormDetails: 존재하지 않는 슬러그 조회 시 found: false를 반환해야 한다", async () => {
    const tools = createQueryTools(dependencies);
    const result = (await tools.getFormDetails.execute!(
      { formSlug: "unknown-slug" },
      mockExecutionOptions
    )) as { found: boolean; message?: string };

    expect(result.found).toBe(false);
    expect(result.message).toContain("unknown-slug");
  });
});
