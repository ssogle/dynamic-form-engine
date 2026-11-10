import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findSubmissionById,
  findSubmissionsByFormId,
  insertSubmission,
  softDeleteSubmissionById,
  softDeleteSubmissionsByIds,
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

const mockReturning = vi.fn();

vi.mock("@/shared/db/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db/server")>();
  return {
    ...actual,
    db: {
      select: () => mockSelect(),
      insert: (table: unknown) => mockInsert(table),
      update: (table: unknown) => mockUpdate(table),
    },
  };
});

describe("Form Submission Server Repository (entities/form-submission/server)", () => {
  const sampleDate = new Date("2026-01-01T00:00:00Z");

  const sampleSubmission = {
    id: "00000000-0000-0000-0000-000000000001",
    formId: "00000000-0000-0000-0000-000000000002",
    data: { name: "홍길동", score: 5 },
    createdAt: sampleDate,
    updatedAt: sampleDate,
    deletedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({
      orderBy: mockOrderBy,
      limit: mockLimit,
      returning: mockReturning,
    });

    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });

    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
  });

  describe("insertSubmission", () => {
    it("유효한 응답 데이터를 DB에 INSERT하고 영속화된 레코드를 반환해야 한다", async () => {
      mockReturning.mockResolvedValueOnce([sampleSubmission]);

      const result = await insertSubmission({
        formId: "00000000-0000-0000-0000-000000000002",
        data: { name: "홍길동", score: 5 },
      });

      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          formId: "00000000-0000-0000-0000-000000000002",
          data: { name: "홍길동", score: 5 },
        })
      );
      expect(result).toEqual(sampleSubmission);
    });

    it("삽입 결과가 반환되지 않으면 에러를 던져야 한다", async () => {
      mockReturning.mockResolvedValueOnce([]);

      await expect(
        insertSubmission({
          formId: "00000000-0000-0000-0000-000000000002",
          data: {},
        })
      ).rejects.toThrow("응답 데이터베이스 삽입 결과가 반환되지 않았습니다.");
    });
  });

  describe("findSubmissionsByFormId", () => {
    it("유효하지 않은 UUID 폼 ID인 경우 DB 쿼리를 타지 않고 빈 배열을 즉시 반환해야 한다", async () => {
      const result = await findSubmissionsByFormId("purchase-list");

      expect(mockSelect).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("특정 폼의 소프트 삭제되지 않은 응답 목록을 생성일 내림차순으로 반환해야 한다", async () => {
      mockOrderBy.mockResolvedValueOnce([sampleSubmission]);

      const result = await findSubmissionsByFormId("00000000-0000-0000-0000-000000000002");

      expect(mockSelect).toHaveBeenCalledTimes(1);
      expect(mockWhere).toHaveBeenCalled();
      expect(result).toEqual([sampleSubmission]);
    });
  });

  describe("findSubmissionById", () => {
    it("유효하지 않은 UUID 응답 ID인 경우 DB 쿼리를 타지 않고 undefined를 즉시 반환해야 한다", async () => {
      const result = await findSubmissionById("non-uuid-id");

      expect(mockSelect).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("특정 ID의 활성 응답 1건을 조회하여 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([sampleSubmission]);

      const result = await findSubmissionById("00000000-0000-0000-0000-000000000001");

      expect(mockSelect).toHaveBeenCalledTimes(1);
      expect(mockLimit).toHaveBeenCalledWith(1);
      expect(result).toEqual(sampleSubmission);
    });

    it("일치하는 응답이 없으면 undefined를 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const result = await findSubmissionById("00000000-0000-0000-0000-000000000099");

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

      const result = await updateSubmissionById("00000000-0000-0000-0000-000000000001", {
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

      const result = await softDeleteSubmissionById("00000000-0000-0000-0000-000000000001");

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

    it("유효하지 않은 UUID들만 전달 시 빈 배열을 반환해야 한다", async () => {
      const result = await softDeleteSubmissionsByIds(["invalid-id-1", "invalid-id-2"]);
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("복수 ID 전달 시 inArray 갱신으로 소프트 삭제를 수행해야 한다", async () => {
      const deletedList = [
        { ...sampleSubmission, id: "00000000-0000-0000-0000-000000000001", deletedAt: new Date() },
        { ...sampleSubmission, id: "00000000-0000-0000-0000-000000000002", deletedAt: new Date() },
      ];
      mockReturning.mockResolvedValueOnce(deletedList);

      const result = await softDeleteSubmissionsByIds([
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
      ]);

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(result).toEqual(deletedList);
    });
  });
});
