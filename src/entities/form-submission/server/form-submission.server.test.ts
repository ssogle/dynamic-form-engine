import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findInboundRelatedSubmissions,
  findSubmissionById,
  findSubmissionsByFormId,
  findSubmissionsPaginated,
  hasSubmissionsByFormId,
  insertSubmission,
  softDeleteSubmissionById,
  softDeleteSubmissionsByIds,
  syncSubmissionRelations,
  updateSubmissionById,
} from "./form-submission.server";

/**
 * 데이터베이스 I/O 경계 모킹 (@/shared/db)
 */
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

const mockInsert = vi.fn();
const mockValues = vi.fn();

const mockUpdate = vi.fn();
const mockSet = vi.fn();

const mockDelete = vi.fn();

const mockReturning = vi.fn();

vi.mock("@/shared/db/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db/server")>();
  return {
    ...actual,
    db: {
      select: () => mockSelect(),
      insert: (table: unknown) => mockInsert(table),
      update: (table: unknown) => mockUpdate(table),
      delete: (table: unknown) => mockDelete(table),
    },
  };
});

describe("Form Submission Server Repository (entities/form-submission/server)", () => {
  const sampleDate = new Date("2026-01-01T00:00:00Z");

  const sampleSubmission = {
    id: "11111111-1111-4111-a111-111111111111",
    formId: "22222222-2222-4222-a222-222222222222",
    data: { name: "홍길동", score: 5 },
    createdAt: sampleDate,
    updatedAt: sampleDate,
    deletedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockLimit.mockResolvedValue([]);
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({
      orderBy: mockOrderBy,
      limit: mockLimit,
      returning: mockReturning,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve([]).then(resolve),
    });

    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({
      returning: mockReturning,
      onConflictDoNothing: vi.fn().mockResolvedValue([]),
    });

    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });

    mockDelete.mockReturnValue({ where: mockWhere });
  });

  describe("insertSubmission", () => {
    it("유효한 응답 데이터를 DB에 INSERT하고 영속화된 레코드를 반환해야 한다", async () => {
      mockReturning.mockResolvedValueOnce([sampleSubmission]);

      const result = await insertSubmission({
        formId: "22222222-2222-4222-a222-222222222222",
        data: { name: "홍길동", score: 5 },
      });

      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          formId: "22222222-2222-4222-a222-222222222222",
          data: { name: "홍길동", score: 5 },
        })
      );
      expect(result).toEqual(sampleSubmission);
    });

    it("삽입 결과가 반환되지 않으면 에러를 던져야 한다", async () => {
      mockReturning.mockResolvedValueOnce([]);

      await expect(
        insertSubmission({
          formId: "22222222-2222-4222-a222-222222222222",
          data: {},
        })
      ).rejects.toThrow("응답 데이터베이스 삽입 결과가 반환되지 않았습니다.");
    });
  });

  describe("findSubmissionsByFormId", () => {
    it("특정 폼의 소프트 삭제되지 않은 응답 목록을 생성일 내림차순으로 반환해야 한다", async () => {
      mockOrderBy.mockResolvedValueOnce([sampleSubmission]);

      const result = await findSubmissionsByFormId("22222222-2222-4222-a222-222222222222");

      expect(mockSelect).toHaveBeenCalledTimes(1);
      expect(mockWhere).toHaveBeenCalled();
      expect(result).toEqual([sampleSubmission]);
    });
  });

  describe("findSubmissionById", () => {
    it("특정 ID의 활성 응답 1건을 조회하여 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([sampleSubmission]);

      const result = await findSubmissionById("11111111-1111-4111-a111-111111111111");

      expect(mockSelect).toHaveBeenCalledTimes(1);
      expect(mockLimit).toHaveBeenCalledWith(1);
      expect(result).toEqual(sampleSubmission);
    });

    it("일치하는 응답이 없으면 undefined를 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const result = await findSubmissionById("33333333-3333-4333-a333-333333333333");

      expect(result).toBeUndefined();
    });
  });

  describe("updateSubmissionById", () => {
    it("기제출된 응답 data를 수정하고 수정된 레코드를 반환해야 한다", async () => {
      const updatedSubmission = {
        ...sampleSubmission,
        data: { name: "홍길동", score: 4 },
        updatedAt: new Date("2026-01-02T00:00:00Z"),
      };
      mockReturning.mockResolvedValueOnce([updatedSubmission]);

      const result = await updateSubmissionById("11111111-1111-4111-a111-111111111111", {
        data: { name: "홍길동", score: 4 },
      });

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: "홍길동", score: 4 },
          updatedAt: expect.anything(),
        })
      );
      expect(result).toEqual(updatedSubmission);
    });
  });

  describe("softDeleteSubmissionById", () => {
    it("deletedAt 컬럼을 갱신하여 소프트 삭제를 수행해야 한다", async () => {
      const deletedSubmission = {
        ...sampleSubmission,
        deletedAt: new Date("2026-01-03T00:00:00Z"),
      };
      mockReturning.mockResolvedValueOnce([deletedSubmission]);

      const result = await softDeleteSubmissionById("11111111-1111-4111-a111-111111111111");

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAt: expect.anything(),
          updatedAt: expect.anything(),
        })
      );
      expect(result).toEqual(deletedSubmission);
    });
  });

  describe("softDeleteSubmissionsByIds", () => {
    it("빈 배열 전달 시 DB 쿼리 없이 빈 배열을 즉시 반환해야 한다", async () => {
      const result = await softDeleteSubmissionsByIds([]);
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("복수 ID 전달 시 inArray 갱신으로 소프트 삭제를 수행해야 한다", async () => {
      const deletedList = [
        { ...sampleSubmission, id: "11111111-1111-4111-a111-111111111111", deletedAt: new Date() },
        { ...sampleSubmission, id: "22222222-2222-4222-a222-222222222222", deletedAt: new Date() },
      ];
      mockReturning.mockResolvedValueOnce(deletedList);

      const result = await softDeleteSubmissionsByIds([
        "11111111-1111-4111-a111-111111111111",
        "22222222-2222-4222-a222-222222222222",
      ]);

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(result).toEqual(deletedList);
    });
  });

  describe("hasSubmissionsByFormId", () => {
    it("활성 응답이 1건 이상 존재하면 true를 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([{ id: sampleSubmission.id }]);
      const result = await hasSubmissionsByFormId(sampleSubmission.formId);
      expect(mockSelect).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });
  });

  describe("syncSubmissionRelations", () => {
    it("단순화된 relations 스키마({ sourceId, targetId, fieldId })만 삽입하고 동일 타깃을 참조하는 서로 다른 관계 필드를 모두 보존해야 한다", async () => {
      const targetSubmissionId = "33333333-3333-4333-a333-333333333333";
      const targetFormId = "44444444-4444-4444-a444-444444444444";

      mockLimit.mockResolvedValueOnce([
        {
          schemaDefinition: {
            fields: [
              {
                id: "rel_requester",
                label: "요청 담당자",
                type: "relation",
                required: true,
                description: "이 문서를 최초 요청한 담당자를 연결합니다.",
                relationConfig: {
                  targetFormId,
                  multiple: false,
                },
              },
              {
                id: "rel_approver",
                label: "최종 승인자",
                type: "relation",
                required: false,
                description: "이 문서를 최종 결재하는 승인자를 연결합니다.",
                relationConfig: {
                  targetFormId,
                  multiple: false,
                },
              },
            ],
          },
        },
      ]);

      await syncSubmissionRelations({
        ...sampleSubmission,
        data: {
          rel_requester: targetSubmissionId,
          rel_approver: targetSubmissionId,
        },
      });

      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledWith([
        {
          sourceId: sampleSubmission.id,
          targetId: targetSubmissionId,
          fieldId: "rel_requester",
        },
        {
          sourceId: sampleSubmission.id,
          targetId: targetSubmissionId,
          fieldId: "rel_approver",
        },
      ]);

      // 불필요한 레거시 컬럼이 포함되지 않았는지 검증
      const insertedRows = mockValues.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
      expect(Object.keys(insertedRows[0] ?? {})).toEqual(["sourceId", "targetId", "fieldId"]);
    });

    it("관계 필드 값에 비표준 문자열이나 중복 ID가 섞여 있으면 유효한 UUID만 중복 제거하여 동기화해야 한다", async () => {
      const validTargetId = "33333333-3333-4333-a333-333333333333";
      const targetFormId = "44444444-4444-4444-a444-444444444444";

      mockLimit.mockResolvedValueOnce([
        {
          schemaDefinition: {
            fields: [
              {
                id: "rel_members",
                label: "관련 구성원",
                type: "relation",
                required: false,
                relationConfig: {
                  targetFormId,
                  multiple: true,
                },
              },
            ],
          },
        },
      ]);

      await syncSubmissionRelations({
        ...sampleSubmission,
        data: {
          rel_members: [
            ` ${validTargetId} `,
            "not-a-uuid",
            "00000000-0000-0000-0000-000000000001",
            validTargetId,
          ],
        },
      });

      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledWith([
        {
          sourceId: sampleSubmission.id,
          targetId: validTargetId,
          fieldId: "rel_members",
        },
      ]);
    });
  });

  describe("findSubmissionsPaginated (ids 배치 필터)", () => {
    it("유효하지 않은 UUID만 포함된 ids 문자열이 전달되면 DB 조회 없이 빈 페이지 결과를 반환해야 한다", async () => {
      const result = await findSubmissionsPaginated(sampleSubmission.formId, {
        ids: "not-a-uuid,another-bad-id",
      } as never);

      expect(mockSelect).not.toHaveBeenCalled();
      expect(result.items).toEqual([]);
      expect(result.totalCount).toBe(0);
    });

    it("유효한 ids가 전달되면 해당 레코드 조건으로 카운트 및 목록 쿼리를 수행해 반환해야 한다", async () => {
      mockWhere.mockResolvedValueOnce([{ count: 1 }]).mockReturnValueOnce({
        orderBy: mockOrderBy,
      });
      const mockOffset = vi.fn().mockResolvedValueOnce([sampleSubmission]);
      mockOrderBy.mockReturnValueOnce({
        limit: vi.fn().mockReturnValueOnce({
          offset: mockOffset,
        }),
      });

      const result = await findSubmissionsPaginated(sampleSubmission.formId, {
        ids: sampleSubmission.id,
      } as never);

      expect(mockSelect).toHaveBeenCalledTimes(2);
      expect(result.totalCount).toBe(1);
      expect(result.items).toEqual([sampleSubmission]);
    });
  });

  describe("findInboundRelatedSubmissions", () => {
    const targetId = "99999999-9999-4999-a999-999999999999";

    it("연결된 관계 엣지가 없으면 빈 배열을 반환하고 추가 쿼리를 실행하지 않아야 한다", async () => {
      mockWhere.mockResolvedValueOnce([]);

      const result = await findInboundRelatedSubmissions(targetId);

      expect(result).toEqual([]);
      expect(mockSelect).toHaveBeenCalledTimes(1);
    });

    it("엣지가 존재하지만 활성 소스 서브미션이 모두 삭제되었으면 빈 배열을 반환해야 한다", async () => {
      mockWhere
        .mockResolvedValueOnce([{ sourceId: sampleSubmission.id, targetId, fieldId: "f_rel" }])
        .mockResolvedValueOnce([]);

      const result = await findInboundRelatedSubmissions(targetId);

      expect(result).toEqual([]);
      expect(mockSelect).toHaveBeenCalledTimes(2);
    });

    it("동일 소스 폼 내 여러 엣지가 같은 서브미션을 가리켜도 중복 없이 소스 폼별로 그룹화해야 한다", async () => {
      const otherFormId = "33333333-3333-4333-a333-333333333333";
      const secondSubmission = {
        ...sampleSubmission,
        id: "44444444-4444-4444-a444-444444444444",
        formId: otherFormId,
      };
      const sourceForms = [
        {
          id: sampleSubmission.formId,
          title: "프로젝트 목록",
          schemaDefinition: { primaryFieldId: "name", fields: [] },
        },
        {
          id: otherFormId,
          title: "이슈 트래커",
          schemaDefinition: { primaryFieldId: "title", fields: [] },
        },
      ];

      mockWhere
        .mockResolvedValueOnce([
          { sourceId: sampleSubmission.id, targetId, fieldId: "f_rel_1" },
          { sourceId: sampleSubmission.id, targetId, fieldId: "f_rel_2" },
          { sourceId: secondSubmission.id, targetId, fieldId: "f_rel_3" },
        ])
        .mockResolvedValueOnce([sampleSubmission, secondSubmission])
        .mockResolvedValueOnce(sourceForms);

      const result = await findInboundRelatedSubmissions(targetId);

      expect(mockSelect).toHaveBeenCalledTimes(3);
      expect(result).toEqual([
        {
          sourceForm: sourceForms[0],
          submissions: [sampleSubmission],
        },
        {
          sourceForm: sourceForms[1],
          submissions: [secondSubmission],
        },
      ]);
    });
  });
});
