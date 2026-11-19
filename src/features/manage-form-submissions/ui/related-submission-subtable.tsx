"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  extractActiveFields,
  extractPrimaryFieldId,
  formatFieldDisplayValue,
  orderFieldsWithPrimaryFirst,
  PrimaryFieldBadge,
  type Form,
} from "@/entities/form";
import type { RelatedSubmissionsGroup } from "@/entities/form-submission";
import type { FieldFilterCondition } from "@/shared/schema";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/shared/ui/table";
import { Button } from "@/shared/ui/button";
import { formatDateTime } from "@/shared/lib/date";
import type { FormSubmissionViewMode } from "../types/submission-view.types";
import { ManageFormSubmissions } from "./manage-form-submissions";

export interface RelatedSubmissionSubtableProps {
  /**
   * 특정 소스 폼에 의해 그룹화된 역참조 서브미션 데이터
   */
  group: RelatedSubmissionsGroup;
  /**
   * 현재 상세 조회 중인 타깃 부모 폼 ID (역참조 relation 필터 구성용)
   */
  targetFormId?: string | undefined;
  /**
   * 현재 상세 조회 중인 타깃 부모 레코드 ID (역참조 relation 필터 구성용)
   */
  targetSubmissionId?: string | undefined;
  /**
   * 동작 모드 (프리뷰 모드에서는 컨슈머 상세 이동 버튼을 숨김)
   */
  mode?: FormSubmissionViewMode | undefined;
}

/**
 * 역참조된 서브미션 목록을 표시하는 서브 테이블 컴포넌트
 *
 * 컨슈머 모드에서 소스 폼이 현재 부모 폼을 참조하는 단일 relation 필드를 보유한 경우
 * `ManageFormSubmissions` 임베디드 테이블로 통합해 가상 스크롤·정렬·컬럼 필터·관계 배지·상세/수정/삭제를 동일하게 제공합니다.
 */
export function RelatedSubmissionSubtable({
  group,
  targetFormId,
  targetSubmissionId,
  mode = "consumer",
}: RelatedSubmissionSubtableProps) {
  const { sourceForm, submissions } = group;

  const rawSourceForm = React.useMemo(
    () =>
      ({
        schemaDefinition: sourceForm.schemaDefinition,
      }) as unknown as Form,
    [sourceForm.schemaDefinition]
  );

  const lockedRelationFilters = React.useMemo<FieldFilterCondition[] | undefined>(() => {
    if (mode !== "consumer" || !targetFormId || !targetSubmissionId) {
      return undefined;
    }
    const matchingFields = extractActiveFields(rawSourceForm).filter(
      (f) => f.type === "relation" && f.relationConfig?.targetFormId === targetFormId
    );
    if (matchingFields.length !== 1 || !matchingFields[0]) {
      return undefined;
    }
    return [
      {
        fieldId: matchingFields[0].id,
        op: "hasAny",
        values: [targetSubmissionId],
      },
    ];
  }, [mode, rawSourceForm, targetFormId, targetSubmissionId]);

  const primaryFieldId = extractPrimaryFieldId(rawSourceForm);

  const columns = React.useMemo(() => {
    // 폴백 경량 테이블용 최대 4개 주요 컬럼 (대표 필드 우선 배치)
    return orderFieldsWithPrimaryFirst(rawSourceForm).slice(0, 4);
  }, [rawSourceForm]);

  if (lockedRelationFilters) {
    return (
      <ManageFormSubmissions
        formId={sourceForm.id}
        embedded
        lockedFilters={lockedRelationFilters}
        mode="consumer"
      />
    );
  }

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
                <div className="flex items-center gap-1.5">
                  <span>{col.label}</span>
                  {col.id === primaryFieldId && <PrimaryFieldBadge />}
                </div>
              </TableHead>
            ))}
            <TableHead className="text-xs font-semibold whitespace-nowrap">제출 일시</TableHead>
            {mode !== "preview" && (
              <TableHead className="w-16 text-right text-xs font-semibold whitespace-nowrap">
                동작
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((sub) => {
            const data = (sub.data ?? {}) as Record<string, unknown>;

            return (
              <TableRow key={sub.id} className="hover:bg-muted/30 text-xs">
                {columns.map((col) => (
                  <TableCell key={col.id} className="max-w-50 truncate py-2.5 font-medium">
                    {formatFieldDisplayValue(data[col.id], col)}
                  </TableCell>
                ))}
                <TableCell className="text-muted-foreground py-2.5 whitespace-nowrap">
                  {formatDateTime(sub.createdAt)}
                </TableCell>
                {mode !== "preview" && (
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
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
