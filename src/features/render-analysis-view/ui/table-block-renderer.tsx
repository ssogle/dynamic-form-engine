"use client";

import * as React from "react";
import type { TableAnalysisBlock } from "@/entities/analysis-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { formatTableCellValue } from "../lib/build-chart-config";
import { BlockSourceLinksFooter } from "./block-source-links-footer";

export interface TableBlockRendererProps {
  block: TableAnalysisBlock;
  /** 카드 헤더 우측에 삽입할 추가 액션 (예: 분석가 캔버스 AI 수정 버튼) */
  headerAction?: React.ReactNode | undefined;
}

/**
 * 분석 뷰 문서의 정형 데이터 비교 테이블 블록 렌더러
 */
export function TableBlockRenderer({ block, headerAction }: TableBlockRendererProps) {
  return (
    <Card>
      {block.title ? (
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base font-semibold">{block.title}</CardTitle>
          {headerAction}
        </CardHeader>
      ) : headerAction ? (
        <div className="flex justify-end px-6 pt-4 pb-0">{headerAction}</div>
      ) : null}
      <CardContent className={block.title || headerAction ? "" : "pt-6"}>
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
