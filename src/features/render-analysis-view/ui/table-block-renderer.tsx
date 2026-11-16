"use client";

import type { TableAnalysisBlock } from "@/entities/analysis-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { formatTableCellValue } from "../lib/build-chart-config";
import { BlockSourceLinksFooter } from "./block-source-links-footer";

export interface TableBlockRendererProps {
  block: TableAnalysisBlock;
}

/**
 * 분석 뷰 문서의 정형 데이터 비교 테이블 블록 렌더러
 */
export function TableBlockRenderer({ block }: TableBlockRendererProps) {
  return (
    <Card>
      {block.title ? (
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">{block.title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className={block.title ? "" : "pt-6"}>
        <div className="border-border overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {block.columns.map((column) => (
                  <TableHead key={column.key}>{column.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {block.rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={block.columns.length}
                    className="text-muted-foreground h-20 text-center"
                  >
                    표시할 비교 데이터가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                block.rows.map((row, rowIdx) => (
                  <TableRow key={rowIdx}>
                    {block.columns.map((column) => (
                      <TableCell key={column.key} className="tabular-nums">
                        {formatTableCellValue(row[column.key])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <BlockSourceLinksFooter block={block} />
    </Card>
  );
}
