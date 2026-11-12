import { extractPrimaryFieldValue, type CoreFormField, type Form } from "@/entities/form";
import type { FormSubmission } from "@/entities/form-submission";

/**
 * 특정 부모 폼과 서브미션 목록에서 참조된 타깃 폼 및 타깃 레코드 ID 집합 규격
 */
export interface RelationTargetGroup {
  targetFormId: string;
  submissionIds: string[];
}

/**
 * 배치 조회로 복원된 타깃 폼별 메타데이터 및 서브미션 딕셔너리
 */
export interface ResolvedTargetDomainEntry {
  targetForm?: Form | undefined;
  rowsById: Record<string, FormSubmission>;
  labelsById: Record<string, string>;
}

export type RelationLookupMap = Record<string, ResolvedTargetDomainEntry>;

/**
 * 상세 화면의 개별 관계형 필드별로 복원된 타깃 레코드 묶음
 */
export interface RelationFieldDetailRows {
  targetForm?: Form | undefined;
  rows: FormSubmission[];
  missingIds: string[];
}

/**
 * 관계형 필드에 저장된 단일 UUID 또는 다중 UUID 배열을 ID 문자열 배열로 정규화합니다.
 */
function normalizeRelationValueToIds(rawVal: unknown): string[] {
  if (typeof rawVal === "string") {
    const trimmed = rawVal.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }
  if (Array.isArray(rawVal)) {
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const item of rawVal) {
      if (typeof item === "string") {
        const trimmed = item.trim();
        if (trimmed.length > 0 && !seen.has(trimmed)) {
          seen.add(trimmed);
          unique.push(trimmed);
        }
      }
    }
    return unique;
  }
  return [];
}

/**
 * 활성 필드와 서브미션 행들을 순회하며, 배치 조회가 필요한 타깃 폼 ID 및
 * 해당 폼에서 참조된 중복 제거 서브미션 ID 목록을 추출합니다.
 *
 * @param fields 부모 폼의 활성 필드 목록
 * @param submissions 현재 화면에 로드된 부모 서브미션 목록
 * @returns 타깃 폼 단위로 그룹핑된 조회 대상 배열 (결정론적 정렬 보장)
 */
export function extractRelationTargets(
  fields: CoreFormField[],
  submissions: FormSubmission[]
): RelationTargetGroup[] {
  const byTargetForm = new Map<string, Set<string>>();

  for (const field of fields) {
    if (field.type !== "relation" || !field.relationConfig?.targetFormId) {
      continue;
    }
    const targetFormId = field.relationConfig.targetFormId;
    let idSet = byTargetForm.get(targetFormId);
    if (!idSet) {
      idSet = new Set<string>();
      byTargetForm.set(targetFormId, idSet);
    }

    for (const sub of submissions) {
      const dataObj = (sub.data as Record<string, unknown>) ?? {};
      const ids = normalizeRelationValueToIds(dataObj[field.id]);
      for (const id of ids) {
        idSet.add(id);
      }
    }
  }

  return Array.from(byTargetForm.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([targetFormId, idSet]) => ({
      targetFormId,
      submissionIds: Array.from(idSet).sort(),
    }));
}

/**
 * 배치 페칭된 타깃 폼 목록과 타깃 서브미션 목록을 조합하여
 * O(1) 접근 가능한 `RelationLookupMap` 딕셔너리를 구성합니다.
 *
 * 각 타깃 서브미션의 라벨은 타깃 폼에 정의된 단일 진실 원천(`primaryFieldId`)을
 * 기반으로 `extractPrimaryFieldValue`를 통해 일관되게 생성됩니다.
 */
export function buildRelationLookupMap(
  targetForms: Array<Form | undefined>,
  targetSubmissions: Array<FormSubmission | undefined>
): RelationLookupMap {
  const formById = new Map<string, Form>();
  for (const form of targetForms) {
    if (form) {
      formById.set(form.id, form);
    }
  }

  const lookup: RelationLookupMap = {};
  for (const form of formById.values()) {
    lookup[form.id] = {
      targetForm: form,
      rowsById: {},
      labelsById: {},
    };
  }

  for (const sub of targetSubmissions) {
    if (!sub) continue;
    const entry = lookup[sub.formId] ?? {
      targetForm: formById.get(sub.formId),
      rowsById: {},
      labelsById: {},
    };
    entry.rowsById[sub.id] = sub;
    entry.labelsById[sub.id] = extractPrimaryFieldValue(entry.targetForm, sub);
    lookup[sub.formId] = entry;
  }

  return lookup;
}

/**
 * 부모 응답 목록 테이블의 1개 셀(Cell)에 렌더링할 관계형 요약 문자열을 생성합니다.
 *
 * - 미선택 / 빈 값: `"-"`
 * - 단일 선택 또는 1건 선택: 타깃 레코드의 대표 필드 값 (예: `"차세대 ERP 구축"`)
 * - 다중 선택(2건 이상): `"첫 번째 대표값 외 N건"` (예: `"차세대 ERP 구축 외 2건"`)
 * - 미조회 / 로딩 중 / 삭제된 참조: 축약 UUID 폴백 (예: `"cccc3333..."`)
 */
export function formatRelationSummaryCell(
  rawVal: unknown,
  field: CoreFormField,
  lookupMap: RelationLookupMap
): string {
  const ids = normalizeRelationValueToIds(rawVal);
  if (ids.length === 0) {
    return "-";
  }

  const targetFormId = field.relationConfig?.targetFormId;
  const labelsById = targetFormId ? lookupMap[targetFormId]?.labelsById : undefined;
  const firstId = ids[0]!;
  const primaryLabel = labelsById?.[firstId] ?? `${firstId.slice(0, 8)}...`;

  if (ids.length === 1) {
    return primaryLabel;
  }
  return `${primaryLabel} 외 ${ids.length - 1}건`;
}

/**
 * 단건 상세 화면에서 관계형 필드에 연결된 타깃 레코드 행(Row) 목록을 복원합니다.
 */
export function getRelationDetailRows(
  rawVal: unknown,
  field: CoreFormField,
  lookupMap: RelationLookupMap
): RelationFieldDetailRows {
  const targetFormId = field.relationConfig?.targetFormId;
  const entry = targetFormId ? lookupMap[targetFormId] : undefined;
  const ids = normalizeRelationValueToIds(rawVal);

  const rows: FormSubmission[] = [];
  const missingIds: string[] = [];

  for (const id of ids) {
    const matched = entry?.rowsById[id];
    if (matched) {
      rows.push(matched);
    } else {
      missingIds.push(id);
    }
  }

  return {
    targetForm: entry?.targetForm,
    rows,
    missingIds,
  };
}
