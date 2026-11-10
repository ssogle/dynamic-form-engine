import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useReactTable, getCoreRowModel, type ColumnDef, type Row } from "@tanstack/react-table";
import { VirtualTable, TABLE_COLUMN_WIDTH } from "./virtual-table";

interface TestRow {
  id: string;
  name: string;
  age: number;
}

const testData: TestRow[] = [
  { id: "1", name: "홍길동", age: 30 },
  { id: "2", name: "김철수", age: 25 },
];

const testColumns: ColumnDef<TestRow>[] = [
  {
    accessorKey: "name",
    header: "이름",
    enableResizing: true,
  },
  {
    accessorKey: "age",
    header: "나이",
    enableResizing: false,
  },
];

function TestTableWrapper({
  onRowClick,
  isFetchingNextPage = false,
  fetchNextPage,
  hasNextPage = false,
}: {
  onRowClick?: ((row: Row<TestRow>) => void) | undefined;
  isFetchingNextPage?: boolean | undefined;
  fetchNextPage?: (() => void) | undefined;
  hasNextPage?: boolean | undefined;
}) {
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: testData,
    columns: testColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <VirtualTable
      table={table}
      onRowClick={onRowClick}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
      hasNextPage={hasNextPage}
    />
  );
}

describe("VirtualTable (shared/lib/virtual-table)", () => {
  it("TABLE_COLUMN_WIDTH 상수에 DEFAULT(200), MIN(150), MAX(500)이 정의되어 있어야 한다", () => {
    expect(TABLE_COLUMN_WIDTH.DEFAULT).toBe(200);
    expect(TABLE_COLUMN_WIDTH.MIN).toBe(150);
    expect(TABLE_COLUMN_WIDTH.MAX).toBe(500);
  });

  it("컬럼 헤더와 데이터 행을 정상적으로 렌더링해야 한다", () => {
    render(<TestTableWrapper />);

    expect(screen.getByText("이름")).toBeInTheDocument();
    expect(screen.getByText("나이")).toBeInTheDocument();
    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(screen.getByText("김철수")).toBeInTheDocument();
  });

  it("리사이징이 활성화된 컬럼에만 리사이저 핸들이 렌더링되어야 한다", () => {
    render(<TestTableWrapper />);

    expect(screen.getByTestId("resizer-name")).toBeInTheDocument();
    expect(screen.queryByTestId("resizer-age")).not.toBeInTheDocument();
  });

  it("행 클릭 시 onRowClick 콜백이 행 데이터와 함께 호출되어야 한다", () => {
    const handleRowClick = vi.fn();
    render(<TestTableWrapper onRowClick={handleRowClick} />);

    const firstRowCell = screen.getByText("홍길동");
    fireEvent.click(firstRowCell);

    expect(handleRowClick).toHaveBeenCalledTimes(1);
    expect(handleRowClick.mock.calls[0]?.[0]?.original).toEqual(testData[0]);
  });

  it("isFetchingNextPage가 true일 때 추가 로딩 인디케이터가 표시되어야 한다", () => {
    render(<TestTableWrapper isFetchingNextPage={true} />);

    expect(screen.getByText("추가 데이터를 불러오는 중입니다...")).toBeInTheDocument();
  });

  it("테이블 요소에 table-fixed 클래스와 동적 총 너비 style이 바인딩되어야 한다", () => {
    const { container } = render(<TestTableWrapper />);

    const tableElement = container.querySelector("table");
    expect(tableElement).toBeInTheDocument();
    expect(tableElement).toHaveClass("table-fixed");
    expect(tableElement?.style.width).toMatch(/\d+px/);
    expect(tableElement?.style.minWidth).toBe("100%");
  });

  it("stretchLastColumn이 true일 때 마지막 컬럼은 minWidth로 신축성을 유지해야 한다", () => {
    const { container } = render(<TestTableWrapper />);

    const thElements = container.querySelectorAll("th");
    expect(thElements.length).toBe(2);

    // 첫 번째 컬럼(name)은 명시적 width 적용
    expect(thElements[0]?.style.width).toMatch(/\d+px/);

    // 마지막 컬럼(age)은 고정 width 없이 minWidth로 공간 흡수
    expect(thElements[1]?.style.width).toBe("");
    expect(thElements[1]?.style.minWidth).toMatch(/\d+px/);
  });

  it("스크롤 컨테이너가 하단에 도달할 때 fetchNextPage 콜백이 호출되어야 한다", () => {
    const handleFetchNextPage = vi.fn();
    const { container } = render(
      <TestTableWrapper
        hasNextPage={true}
        isFetchingNextPage={false}
        fetchNextPage={handleFetchNextPage}
      />
    );

    const scrollContainer = container.querySelector("[data-slot='table-container']");
    expect(scrollContainer).toBeInTheDocument();

    if (scrollContainer) {
      // scrollHeight: 1000, scrollTop: 750, clientHeight: 200 => scrollBottom: 50 (< 250px)
      Object.defineProperty(scrollContainer, "scrollHeight", { value: 1000, configurable: true });
      Object.defineProperty(scrollContainer, "scrollTop", { value: 750, configurable: true });
      Object.defineProperty(scrollContainer, "clientHeight", { value: 200, configurable: true });

      fireEvent.scroll(scrollContainer);
      expect(handleFetchNextPage).toHaveBeenCalled();
    }
  });
});
