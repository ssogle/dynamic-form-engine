import type { Form } from "../schema/form.schema";
import { extractActiveFields } from "./extract-active-fields";

/**
 * 3D 도메인 관계 그래프의 폼 노드 표현 모델
 */
export interface FormRelationGraphNode {
  /** 폼 고유 식별자(UUID) */
  id: string;
  /** 폼 제목 */
  title: string;
  /** 공식 발행 여부 */
  isPublished: boolean;
  /** 소프트 삭제 제외 활성 필드 개수 */
  activeFieldCount: number;
  /** 해당 폼이 참여하는 유효 관계 차수 (송신 + 수신) */
  relationDegree: number;
}

/**
 * 3D 도메인 관계 그래프의 관계(relation) 엣지 표현 모델
 */
export interface FormRelationGraphLink {
  /** 링크 고유 식별자 (`{sourceFormId}:{fieldId}`) */
  id: string;
  /** 관계를 소유한 소스 폼 ID */
  source: string;
  /** 참조 대상 타깃 폼 ID */
  target: string;
  /** 관계를 정의한 필드 ID */
  fieldId: string;
  /** 관계를 정의한 필드 라벨 */
  label: string;
  /** 다중 선택 허용 여부 */
  multiple: boolean;
  /** 동일 노드 쌍 간 다중 엣지 겹침 방지를 위한 3D 곡률 */
  curvature: number;
}

/**
 * 3D Force Graph에 전달할 전체 그래프 데이터 구조
 */
export interface FormRelationGraphData {
  nodes: FormRelationGraphNode[];
  links: FormRelationGraphLink[];
}

/**
 * 활성 폼 목록(`Form[]`)으로부터 관계형(`relation`) 연결 구조를 추출해
 * 3D Force Graph 렌더링용 순수 그래프 데이터(`nodes`, `links`)를 생성합니다.
 *
 * - 소프트 삭제된 필드(`deletedAt`)와 존재하지 않는 타깃 폼으로의 고아 링크는 제외합니다.
 * - 동일 두 폼 간 복수 관계나 자기 참조(self-loop) 링크는 곡률(`curvature`)을 분산해 겹침을 방지합니다.
 */
export function buildFormRelationGraph(forms: readonly Form[]): FormRelationGraphData {
  const validFormMap = new Map<string, Form>();
  const activeFieldCountMap = new Map<string, number>();

  for (const form of forms) {
    if (form.deletedAt) continue;
    validFormMap.set(form.id, form);
    activeFieldCountMap.set(form.id, extractActiveFields(form).length);
  }

  const rawLinks: Array<Omit<FormRelationGraphLink, "curvature">> = [];
  const degreeMap = new Map<string, number>();

  for (const form of validFormMap.values()) {
    const activeFields = extractActiveFields(form);
    for (const field of activeFields) {
      if (field.type !== "relation" || !field.relationConfig?.targetFormId) {
        continue;
      }
      const targetId = field.relationConfig.targetFormId;
      if (!validFormMap.has(targetId)) {
        continue;
      }

      rawLinks.push({
        id: `${form.id}:${field.id}`,
        source: form.id,
        target: targetId,
        fieldId: field.id,
        label: field.label,
        multiple: Boolean(field.relationConfig.multiple),
      });

      degreeMap.set(form.id, (degreeMap.get(form.id) ?? 0) + 1);
      if (targetId !== form.id) {
        degreeMap.set(targetId, (degreeMap.get(targetId) ?? 0) + 1);
      }
    }
  }

  // 동일 노드 쌍(무방향 기준) 내 링크 개수별로 곡률을 분산 계산합니다.
  const pairGroups = new Map<string, Array<Omit<FormRelationGraphLink, "curvature">>>();
  for (const link of rawLinks) {
    const pairKey = [link.source, link.target].sort().join("::");
    const group = pairGroups.get(pairKey) ?? [];
    group.push(link);
    pairGroups.set(pairKey, group);
  }

  const links: FormRelationGraphLink[] = [];
  for (const group of pairGroups.values()) {
    const count = group.length;
    group.forEach((item, index) => {
      let curvature = 0;
      if (item.source === item.target) {
        curvature = 0.4 + index * 0.15;
      } else if (count > 1) {
        curvature = (index - (count - 1) / 2) * 0.25;
      }
      links.push({
        ...item,
        curvature,
      });
    });
  }

  const nodes: FormRelationGraphNode[] = Array.from(validFormMap.values()).map((form) => ({
    id: form.id,
    title: form.title,
    isPublished: Boolean(form.publishedAt),
    activeFieldCount: activeFieldCountMap.get(form.id) ?? 0,
    relationDegree: degreeMap.get(form.id) ?? 0,
  }));

  return { nodes, links };
}
