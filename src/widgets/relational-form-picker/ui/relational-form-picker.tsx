"use client";

import * as React from "react";
import { ManageFormSubmissions } from "@/features/manage-form-submissions";
import {
  ConsumerFormSubmitter,
  type ConsumerFormSubmitterProps,
  ConsumerSubmissionEditor,
  type ConsumerSubmissionEditorProps,
  type RelationPickerSlotProps,
  type RelationSelectedTableSlotProps,
} from "@/features/render-dynamic-form";

/**
 * 관계형 필드 다이얼로그 내부에 공통 응답 테이블(ManageFormSubmissions)을 선택 모드로 주입하는 렌더 함수
 *
 * `features/render-dynamic-form`과 `features/manage-form-submissions` 간 수평 참조 없이
 * `widgets/` 레이어에서 두 기능을 슬롯으로 결합하여 단일 테이블 UX(서버 필터링, 다중 정렬, 관계 뱃지 요약)를 제공합니다.
 */
function renderRelationalPickerTable(slot: RelationPickerSlotProps): React.ReactNode {
  return (
    <ManageFormSubmissions
      formId={slot.targetFormId}
      mode="consumer"
      embedded
      compact
      selectionMode={{
        multiple: slot.multiple,
        selectedIds: slot.selectedIds,
        onToggleSelect: slot.onToggleSelect,
      }}
    />
  );
}

/**
 * 폼 입력/수정 화면에서 이미 선택된 관계형 레코드 목록을 공통 응답 테이블로 주입하는 렌더 함수
 *
 * 상세 화면의 정방향 관계형 테이블과 동일하게 `lockedFilters`로 선택 ID만 필터링하고,
 * 읽기 전용이 아닐 때는 행 우측 연결 해제(`X`) 버튼을 제공합니다.
 */
function renderRelationalSelectedTable(slot: RelationSelectedTableSlotProps): React.ReactNode {
  return (
    <ManageFormSubmissions
      formId={slot.targetFormId}
      mode="consumer"
      embedded
      compact
      lockedFilters={[{ fieldId: "id", op: "in", values: [...slot.selectedIds] }]}
      onRemoveSelectedRow={slot.disabled ? undefined : slot.onRemove}
    />
  );
}

/**
 * 관계형 테이블 피커가 결합된 컨슈머 신규 응답 제출 위젯 Props
 */
export type RelationalFormSubmitterProps = Omit<
  ConsumerFormSubmitterProps,
  "renderRelationPicker" | "renderRelationSelectedTable"
>;

/**
 * 관계형 레코드 선택 피커 및 선택 결과 테이블(`ManageFormSubmissions`)이 통합된 컨슈머 신규 응답 제출 위젯
 */
export function RelationalFormSubmitter({ formId }: RelationalFormSubmitterProps) {
  return (
    <ConsumerFormSubmitter
      formId={formId}
      renderRelationPicker={renderRelationalPickerTable}
      renderRelationSelectedTable={renderRelationalSelectedTable}
    />
  );
}

/**
 * 관계형 테이블 피커가 결합된 컨슈머 응답 수정 위젯 Props
 */
export type RelationalSubmissionEditorProps = Omit<
  ConsumerSubmissionEditorProps,
  "renderRelationPicker" | "renderRelationSelectedTable"
>;

/**
 * 관계형 레코드 선택 피커 및 선택 결과 테이블(`ManageFormSubmissions`)이 통합된 컨슈머 응답 수정 위젯
 */
export function RelationalSubmissionEditor({
  formId,
  submissionId,
}: RelationalSubmissionEditorProps) {
  return (
    <ConsumerSubmissionEditor
      formId={formId}
      submissionId={submissionId}
      renderRelationPicker={renderRelationalPickerTable}
      renderRelationSelectedTable={renderRelationalSelectedTable}
    />
  );
}
