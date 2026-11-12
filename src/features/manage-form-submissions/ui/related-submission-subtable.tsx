"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { extractActiveFields, type Form } from "@/entities/form";
import type { RelatedSubmissionsGroup } from "@/entities/form-submission";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/shared/ui/table";
import { Button } from "@/shared/ui/button";
import { formatDateTime } from "@/shared/lib/date";

export interface RelatedSubmissionSubtableProps {
  /**
   * 특정 소스 폼에 의해 그룹화된 역참조 서브미션 데이터
   */
  group: RelatedSubmissionsGroup;
}

/**
 * 필드 값 시각화 포맷 유틸리티
 * 원시 데이터(문자열, 숫자, 불리언, 배열, 객체 등)를 사용자 친화적인 문자열로 변환합니다.
 */
function formatFieldValue(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  if (typeof value === "boolean") {
    return value ? "예" : "아니오";
  }
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * 역참조된 서브미션 목록을 표시하는 서브 테이블 컴포넌트
 *
 * 소스 폼의 스키마를 기반으로 주요 도메인 컬럼을 추출하여
 * 연결된 각 서브미션 레코드의 요약 정보와 상세 페이지 바로가기 링크를 렌더링합니다.
 */
export function RelatedSubmissionSubtable({ group }: RelatedSubmissionSubtableProps) {
  const { sourceForm, submissions } = group;

  // 1. 소스 폼의 활성 필드 추출
  const columns = React.useMemo(() => {
    const rawForm = {
      schemaDefinition: sourceForm.schemaDefinition,
    } as unknown as Form;

    const allActive = extractActiveFields(rawForm);
    // 최대 4개의 주요 데이터 컬럼만 노출하여 테이블 가독성 유지
    return allActive.slice(0, 4);
  }, [sourceForm.schemaDefinition]);

  if (!submissions || submissions.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground text-xs">연결된 응답 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            {columns.map((col) => (
              <TableHead key={col.id} className="text-xs font-semibold whitespace-nowrap">
                {col.label}
              </TableHead>
            ))}
            <TableHead className="text-xs font-semibold whitespace-nowrap">제출 일시</TableHead>
            <TableHead className="w-16 text-right text-xs font-semibold whitespace-nowrap">
              동작
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((sub) => {
            const data = (sub.data ?? {}) as Record<string, unknown>;

            return (
              <TableRow key={sub.id} className="hover:bg-muted/30 text-xs">
                {columns.map((col) => (
                  <TableCell key={col.id} className="max-w-50 truncate py-2.5 font-medium">
                    {formatFieldValue(data[col.id])}
                  </TableCell>
                ))}
                <TableCell className="text-muted-foreground py-2.5 whitespace-nowrap">
                  {formatDateTime(sub.createdAt)}
                </TableCell>
                <TableCell className="py-2.5 text-right whitespace-nowrap">
                  <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                    <Link
                      href={`/consumer/forms/${sourceForm.id}/submissions/${sub.id}`}
                      className="inline-flex items-center gap-1"
                    >
                      <span>보기</span>
                      <ArrowUpRight className="size-3" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
