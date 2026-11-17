import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findActiveAnalysisViews,
  findAnalysisViewById,
  findPublishedAnalysisViewById,
  findPublishedAnalysisViews,
  insertAnalysisView,
  publishAnalysisViewById,
  softDeleteAnalysisViewById,
  softDeleteAnalysisViewsByIds,
  updateAnalysisViewById,
} from "./analysis-view.server";

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

describe("AnalysisView Server Repository (entities/analysis-view/server)", () => {
  const sampleDate = new Date("2026-11-16T00:00:00Z");

  const sampleView = {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    title: "2026년 1분기 매출·비용 분석",
    description: "분기별 손익 비교 문서",
    blocks: [
      {
        id: "blk_1",
        type: "text" as const,
        content: "1분기 매출은 전년 대비 15% 성장했습니다.",
      },
    ],
    createdAt: sampleDate,
    updatedAt: sampleDate,
    publishedAt: null,
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
    mockOrderBy.mockResolvedValue([sampleView]);
    mockLimit.mockResolvedValue([sampleView]);

    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });

    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockReturning.mockResolvedValue([sampleView]);
  });

  it("findActiveAnalysisViews는 소프트 삭제되지 않은 분석 뷰 목록을 반환해야 한다", async () => {
    const result = await findActiveAnalysisViews();

    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(mockOrderBy).toHaveBeenCalledTimes(1);
    expect(result).toEqual([sampleView]);
  });

  it("findPublishedAnalysisViews는 발행된 분석 뷰 목록을 반환해야 한다", async () => {
    const result = await findPublishedAnalysisViews();

    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(mockOrderBy).toHaveBeenCalledTimes(1);
    expect(result).toEqual([sampleView]);
  });

  it("findAnalysisViewById 및 findPublishedAnalysisViewById는 단건 또는 undefined를 반환해야 한다", async () => {
    expect(await findAnalysisViewById(sampleView.id)).toEqual(sampleView);

    mockLimit.mockResolvedValueOnce([]);
    expect(await findPublishedAnalysisViewById(sampleView.id)).toBeUndefined();
  });

  it("insertAnalysisView는 신규 분석 뷰를 삽입하고 반환해야 한다", async () => {
    const result = await insertAnalysisView({
      title: sampleView.title,
      description: sampleView.description,
      blocks: sampleView.blocks,
    });

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledTimes(1);
    expect(result).toEqual(sampleView);
  });

  it("insertAnalysisView는 반환 결과가 비어있으면 예외를 발생시켜야 한다", async () => {
    mockReturning.mockResolvedValueOnce([]);

    await expect(
      insertAnalysisView({
        title: sampleView.title,
        blocks: [],
      })
    ).rejects.toThrow("분석 뷰 데이터베이스 삽입 결과가 반환되지 않았습니다.");
  });

  it("updateAnalysisViewById는 대상 분석 뷰를 수정하고 반환해야 한다", async () => {
    const updated = { ...sampleView, title: "수정된 제목" };
    mockReturning.mockResolvedValueOnce([updated]);

    const result = await updateAnalysisViewById(sampleView.id, { title: "수정된 제목" });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(result).toEqual(updated);
  });

  it("publishAnalysisViewById는 발행 여부에 따라 publishedAt을 갱신해야 한다", async () => {
    const published = { ...sampleView, publishedAt: sampleDate };
    mockReturning.mockResolvedValueOnce([published]);

    const result = await publishAnalysisViewById(sampleView.id, true);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        publishedAt: expect.anything(),
        updatedAt: expect.anything(),
      })
    );
    expect(result).toEqual(published);

    const unpublished = { ...sampleView, publishedAt: null };
    mockReturning.mockResolvedValueOnce([unpublished]);
    const unpubResult = await publishAnalysisViewById(sampleView.id, false);
    expect(mockSet).toHaveBeenLastCalledWith(
      expect.objectContaining({
        publishedAt: null,
        updatedAt: expect.anything(),
      })
    );
    expect(unpubResult).toEqual(unpublished);
  });

  it("softDeleteAnalysisViewById 및 softDeleteAnalysisViewsByIds는 소프트 삭제를 수행해야 한다", async () => {
    const deleted = { ...sampleView, deletedAt: sampleDate };
    mockReturning.mockResolvedValueOnce([deleted]);
    expect(await softDeleteAnalysisViewById(sampleView.id)).toEqual(deleted);

    expect(await softDeleteAnalysisViewsByIds([])).toEqual([]);
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    mockReturning.mockResolvedValueOnce([deleted]);
    expect(await softDeleteAnalysisViewsByIds([sampleView.id])).toEqual([deleted]);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });
});
