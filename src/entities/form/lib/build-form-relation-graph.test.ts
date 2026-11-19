import { describe, expect, it } from "vitest";
import type { Form } from "../schema/form.schema";
import { buildFormRelationGraph } from "./build-form-relation-graph";

function createMockForm(overrides: Partial<Form> & { id: string; title: string }): Form {
  return {
    description: null,
    schemaDefinition: { primaryFieldId: "f1", fields: [] },
    publishedAt: null,
    version: 1,
    createdAt: new Date("2026-11-01T00:00:00Z"),
    updatedAt: new Date("2026-11-01T00:00:00Z"),
    deletedAt: null,
    ...overrides,
  };
}

describe("buildFormRelationGraph (entities/form/lib)", () => {
  it("활성 폼과 유효한 relation 필드를 노드와 방향성 링크로 변환하고 차수를 집계해야 한다", () => {
    const projectForm = createMockForm({
      id: "form-project",
      title: "프로젝트 마스터",
      publishedAt: new Date("2026-11-02T00:00:00Z"),
      schemaDefinition: {
        primaryFieldId: "f_name",
        fields: [
          { id: "f_name", label: "프로젝트명", type: "text", required: true, description: "명칭" },
          {
            id: "f_deleted",
            label: "폐기필드",
            type: "text",
            required: false,
            description: "삭제됨",
            deletedAt: "2026-11-05T00:00:00Z",
          },
        ],
      },
    });

    const workLogForm = createMockForm({
      id: "form-worklog",
      title: "작업 일지",
      publishedAt: null,
      schemaDefinition: {
        primaryFieldId: "f_title",
        fields: [
          { id: "f_title", label: "작업명", type: "text", required: true, description: "작업" },
          {
            id: "f_rel_proj",
            label: "귀속 프로젝트",
            type: "relation",
            required: true,
            description: "연결 프로젝트",
            relationConfig: { targetFormId: "form-project", multiple: false },
          },
        ],
      },
    });

    const isolatedForm = createMockForm({
      id: "form-notice",
      title: "공지 사항",
      schemaDefinition: {
        primaryFieldId: "f_msg",
        fields: [
          { id: "f_msg", label: "내용", type: "textarea", required: true, description: "내용" },
        ],
      },
    });

    const graph = buildFormRelationGraph([projectForm, workLogForm, isolatedForm]);

    expect(graph.nodes).toEqual([
      {
        id: "form-project",
        title: "프로젝트 마스터",
        isPublished: true,
        activeFieldCount: 1,
        relationDegree: 1,
      },
      {
        id: "form-worklog",
        title: "작업 일지",
        isPublished: false,
        activeFieldCount: 2,
        relationDegree: 1,
      },
      {
        id: "form-notice",
        title: "공지 사항",
        isPublished: false,
        activeFieldCount: 1,
        relationDegree: 0,
      },
    ]);

    expect(graph.links).toEqual([
      {
        id: "form-worklog:f_rel_proj",
        source: "form-worklog",
        target: "form-project",
        fieldId: "f_rel_proj",
        label: "귀속 프로젝트",
        multiple: false,
        curvature: 0,
      },
    ]);
  });

  it("소프트 삭제된 관계 필드와 존재하지 않는 타깃 폼을 참조하는 고아 엣지는 제외해야 한다", () => {
    const sourceForm = createMockForm({
      id: "form-source",
      title: "지출 내역",
      schemaDefinition: {
        primaryFieldId: "f_item",
        fields: [
          { id: "f_item", label: "항목", type: "text", required: true, description: "항목" },
          {
            id: "f_rel_deleted",
            label: "삭제된 관계",
            type: "relation",
            required: false,
            description: "삭제됨",
            deletedAt: "2026-11-05T00:00:00Z",
            relationConfig: { targetFormId: "form-target", multiple: false },
          },
          {
            id: "f_rel_missing",
            label: "사라진 폼 참조",
            type: "relation",
            required: false,
            description: "고아 참조",
            relationConfig: { targetFormId: "non-existent-form", multiple: true },
          },
        ],
      },
    });
    const targetForm = createMockForm({ id: "form-target", title: "부서" });

    const graph = buildFormRelationGraph([sourceForm, targetForm]);
    expect(graph.links).toEqual([]);
    expect(graph.nodes.every((n) => n.relationDegree === 0)).toBe(true);
  });

  it("동일 두 폼 간 복수 관계 필드와 자기 참조 링크는 서로 다른 curvature를 부여해야 한다", () => {
    const memberForm = createMockForm({
      id: "form-member",
      title: "임직원",
      schemaDefinition: {
        primaryFieldId: "f_name",
        fields: [
          { id: "f_name", label: "이름", type: "text", required: true, description: "이름" },
          {
            id: "f_manager",
            label: "상급자",
            type: "relation",
            required: false,
            description: "자기 참조",
            relationConfig: { targetFormId: "form-member", multiple: false },
          },
        ],
      },
    });

    const approvalForm = createMockForm({
      id: "form-approval",
      title: "결재 요청",
      schemaDefinition: {
        primaryFieldId: "f_title",
        fields: [
          { id: "f_title", label: "제목", type: "text", required: true, description: "제목" },
          {
            id: "f_requester",
            label: "요청자",
            type: "relation",
            required: true,
            description: "요청자",
            relationConfig: { targetFormId: "form-member", multiple: false },
          },
          {
            id: "f_approver",
            label: "승인자",
            type: "relation",
            required: true,
            description: "승인자",
            relationConfig: { targetFormId: "form-member", multiple: false },
          },
        ],
      },
    });

    const graph = buildFormRelationGraph([memberForm, approvalForm]);
    expect(graph.links).toHaveLength(3);

    const selfLink = graph.links.find((l) => l.fieldId === "f_manager");
    expect(selfLink?.curvature).toBeGreaterThan(0);

    const parallelLinks = graph.links.filter(
      (l) => l.source === "form-approval" && l.target === "form-member"
    );
    expect(parallelLinks).toHaveLength(2);
    expect(parallelLinks[0]?.curvature).not.toBe(parallelLinks[1]?.curvature);
  });
});
