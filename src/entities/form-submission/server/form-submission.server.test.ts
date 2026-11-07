import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findSubmissionById,
  findSubmissionsByFormId,
  insertSubmission,
  softDeleteSubmissionById,
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

vi.mock("@/shared/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db")>();
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
    id: "sub-1234-uuid",
    formId: "form-5678-uuid",
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
        formId: "form-5678-uuid",
        data: { name: "홍길동", score: 5 },
      });

      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          formId: "form-5678-uuid",
          data: { name: "홍길동", score: 5 },
        })
      );
      expect(result).toEqual(sampleSubmission);
    });

    it("삽입 결과가 반환되지 않으면 에러를 던져야 한다", async () => {
      mockReturning.mockResolvedValueOnce([]);

      await expect(
        insertSubmission({
          formId: "form-5678-uuid",
          data: {},
        })
      ).rejects.toThrow("응답 데이터베이스 삽입 결과가 반환되지 않았습니다.");
    });
  });

  describe("findSubmissionsByFormId", () => {
    it("특정 폼의 소프트 삭제되지 않은 응답 목록을 생성일 내림차순으로 반환해야 한다", async () => {
      mockOrderBy.mockResolvedValueOnce([sampleSubmission]);

      const result = await findSubmissionsByFormId("form-5678-uuid");

      expect(mockSelect).toHaveBeenCalledTimes(1);
      expect(mockWhere).toHaveBeenCalled();
      expect(result).toEqual([sampleSubmission]);
    });
  });

  describe("findSubmissionById", () => {
    it("특정 ID의 활성 응답 1건을 조회하여 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([sampleSubmission]);

      const result = await findSubmissionById("sub-1234-uuid");

      expect(mockSelect).toHaveBeenCalledTimes(1);
      expect(mockLimit).toHaveBeenCalledWith(1);
      expect(result).toEqual(sampleSubmission);
    });

    it("일치하는 응답이 없으면 undefined를 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const result = await findSubmissionById("not-found-id");

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

      const result = await updateSubmissionById("sub-1234-uuid", {
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

      const result = await softDeleteSubmissionById("sub-1234-uuid");

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
});
