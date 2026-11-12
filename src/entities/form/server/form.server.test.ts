import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findActiveForms,
  findFormById,
  findPublishedForms,
  findPublishedFormById,
  insertForm,
  publishFormById,
  softDeleteFormById,
  softDeleteFormsByIds,
  updateFormById,
} from "./form.server";

/**
 * 데이터베이스 I/O 경계 모킹 (@/shared/db)
 * 실제 PostgreSQL 연결 없이 Drizzle 쿼리 빌더 호출 흐름을 단위 테스트로 격리 검증합니다.
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

describe("Form Server Repository (entities/form/server)", () => {
  const sampleDate = new Date("2026-01-01T00:00:00Z");

  const sampleForm = {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    title: "일일 업무 보고서",
    description: "업무 기록 폼",
    schemaDefinition: { fields: [] },
    createdAt: sampleDate,
    updatedAt: sampleDate,
    deletedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Drizzle select 체이닝 모킹 (select().from().where().orderBy() / limit())
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({
      orderBy: mockOrderBy,
      limit: mockLimit,
      returning: mockReturning,
    });
    mockOrderBy.mockResolvedValue([sampleForm]);
    mockLimit.mockResolvedValue([sampleForm]);

    // Drizzle insert 체이닝 모킹 (insert().values().returning())
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });

    // Drizzle update 체이닝 모킹 (update().set().where().returning())
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockReturning.mockResolvedValue([sampleForm]);
  });

  describe("findActiveForms", () => {
    it("소프트 삭제되지 않은 활성 폼 목록을 반환해야 한다", async () => {
      const result = await findActiveForms();

      expect(mockSelect).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledTimes(1);
      expect(mockWhere).toHaveBeenCalledTimes(1);
      expect(mockOrderBy).toHaveBeenCalledTimes(1);
      expect(result).toEqual([sampleForm]);
    });
  });

  describe("findFormById", () => {
    it("일치하는 ID의 활성 폼 1건을 조회하여 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([sampleForm]);

      const result = await findFormById("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");

      expect(mockSelect).toHaveBeenCalledTimes(1);
      expect(mockWhere).toHaveBeenCalledTimes(1);
      expect(mockLimit).toHaveBeenCalledWith(1);
      expect(result).toEqual(sampleForm);
    });

    it("UUID 형식이 아닌 ID로 조회 시 DB 쿼리를 타지 않고 undefined를 즉시 반환해야 한다", async () => {
      const result = await findFormById("invalid-uuid-string");

      expect(mockSelect).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("일치하는 폼이 없으면 undefined를 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const result = await findFormById("00000000-0000-0000-0000-000000000000");

      expect(result).toBeUndefined();
    });
  });

  describe("insertForm", () => {
    it("신규 폼 데이터를 삽입하고 영속화된 레코드를 반환해야 한다", async () => {
      const inputData = {
        title: "새로운 폼",
        description: "새로운 폼 설명",
        schemaDefinition: { primaryFieldId: "f_title", fields: [] },
      };

      mockReturning.mockResolvedValueOnce([sampleForm]);

      const result = await insertForm(inputData);

      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledWith(inputData);
      expect(mockReturning).toHaveBeenCalledTimes(1);
      expect(result).toEqual(sampleForm);
    });

    it("삽입 결과가 반환되지 않으면 에러를 던져야 한다", async () => {
      mockReturning.mockResolvedValueOnce([]);

      await expect(
        insertForm({
          title: "깨진 삽입",
          schemaDefinition: { primaryFieldId: "f_title", fields: [] },
        })
      ).rejects.toThrow("폼 데이터베이스 삽입 결과가 반환되지 않았습니다.");
    });
  });

  describe("updateFormById", () => {
    it("폼 메타데이터를 수정하고 수정된 레코드를 반환해야 한다", async () => {
      const updateData = { title: "수정된 폼 제목" };
      mockReturning.mockResolvedValueOnce([{ ...sampleForm, title: "수정된 폼 제목" }]);

      const result = await updateFormById(sampleForm.id, updateData);

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledTimes(1);
      expect(result?.title).toBe("수정된 폼 제목");
    });
  });

  describe("softDeleteFormById", () => {
    it("deletedAt 컬럼을 갱신하여 소프트 삭제를 수행해야 한다", async () => {
      const deletedForm = { ...sampleForm, deletedAt: new Date() };
      mockReturning.mockResolvedValueOnce([deletedForm]);

      const result = await softDeleteFormById(sampleForm.id);

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAt: expect.anything(),
          updatedAt: expect.anything(),
        })
      );
      expect(result?.deletedAt).toBeDefined();
    });
  });

  describe("softDeleteFormsByIds", () => {
    it("빈 ID 배열이 전달되면 DB 쿼리 없이 빈 배열을 즉시 반환해야 한다", async () => {
      const result = await softDeleteFormsByIds([]);
      expect(result).toEqual([]);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("여러 UUID가 전달되면 단일 update 쿼리로 일괄 소프트 삭제를 수행해야 한다", async () => {
      const id1 = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
      const id2 = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
      const deletedList = [
        { ...sampleForm, id: id1, deletedAt: new Date() },
        { ...sampleForm, id: id2, deletedAt: new Date() },
      ];
      mockReturning.mockResolvedValueOnce(deletedList);

      const result = await softDeleteFormsByIds([id1, id2]);

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAt: expect.anything(),
          updatedAt: expect.anything(),
        })
      );
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe(id1);
    });
  });

  describe("findPublishedForms", () => {
    it("발행된 활성 폼 목록을 반환해야 한다", async () => {
      const publishedForm = { ...sampleForm, publishedAt: sampleDate };
      mockOrderBy.mockResolvedValueOnce([publishedForm]);

      const result = await findPublishedForms();

      expect(mockSelect).toHaveBeenCalledTimes(1);
      expect(mockWhere).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]?.publishedAt).toEqual(sampleDate);
    });
  });

  describe("findPublishedFormById", () => {
    it("발행된 폼 1건을 조회해야 한다", async () => {
      const publishedForm = { ...sampleForm, publishedAt: sampleDate };
      mockLimit.mockResolvedValueOnce([publishedForm]);

      const result = await findPublishedFormById("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");

      expect(mockSelect).toHaveBeenCalledTimes(1);
      expect(mockLimit).toHaveBeenCalledWith(1);
      expect(result).toEqual(publishedForm);
    });

    it("UUID 형식이 아닌 경우 undefined를 반환해야 한다", async () => {
      const result = await findPublishedFormById("invalid-id");

      expect(mockSelect).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("일치하는 발행 폼이 없으면 undefined를 반환해야 한다", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const result = await findPublishedFormById("00000000-0000-0000-0000-000000000000");

      expect(result).toBeUndefined();
    });
  });

  describe("publishFormById", () => {
    it("isPublished가 true일 때 publishedAt을 DB 시계로 갱신하여 발행 상태로 만들어야 한다", async () => {
      const published = { ...sampleForm, publishedAt: sampleDate };
      mockReturning.mockResolvedValueOnce([published]);

      const result = await publishFormById("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", true);

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          publishedAt: expect.anything(),
          updatedAt: expect.anything(),
        })
      );
      expect(result).toEqual(published);
    });

    it("isPublished가 false일 때 publishedAt을 null로 초기화하여 초안으로 회수해야 한다", async () => {
      const unpublished = { ...sampleForm, publishedAt: null };
      mockReturning.mockResolvedValueOnce([unpublished]);

      const result = await publishFormById("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", false);

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          publishedAt: null,
          updatedAt: expect.anything(),
        })
      );
      expect(result).toEqual(unpublished);
    });

    it("UUID 형식이 아닌 경우 DB 쿼리를 타지 않고 undefined를 즉시 반환해야 한다", async () => {
      const result = await publishFormById("invalid-id", true);

      expect(mockUpdate).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });
});
