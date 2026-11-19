import { tool } from "ai";
import {
  extractActiveFields,
  extractPrimaryFieldId,
  extractRawFields,
  mergeOptionsWithPreservation,
  normalizeSelectOption,
  normalizeSelectOptions,
  validateFormSchemaTransition,
  validatePrimaryFieldSelection,
  type CoreFormField,
  type Form,
  type InsertForm,
  type SelectOption,
  type UpdateForm,
} from "@/entities/form";
import { nowUtcIso } from "@/shared/lib/date";
import type { OptimisticUpdateResult } from "@/shared/lib/http";
import {
  addRelationFieldInputSchema,
  createFormInputSchema,
  deleteFormsInputSchema,
  navigateInputSchema,
  publishFormInputSchema,
  updateFieldOptionsInputSchema,
  updateSchemaInputSchema,
  type AddRelationFieldInput,
  type CreateFormInput,
  type DeleteFormsInput,
  type NavigateInput,
  type PublishFormInput,
  type UpdateFieldOptionsInput,
  type UpdateSchemaInput,
} from "../../schema/navigator-tools.schema";
import type { NavigatorBuilderAction } from "../../types/navigator-action.types";

export {
  addRelationFieldInputSchema,
  createFormInputSchema,
  deleteFormsInputSchema,
  navigateInputSchema,
  publishFormInputSchema,
  updateFieldOptionsInputSchema,
  updateSchemaInputSchema,
};

/**
 * 폼 엔티티의 schemaDefinition 내부에서 CoreFormField 배열을 안전하게 추출하는 유틸리티
 */
export function extractFieldsFromForm(form?: Form | null): CoreFormField[] {
  return extractRawFields(form);
}

/**
 * AI 도구가 새 필드를 추가할 때 1ms 이내 연속 호출에서도 충돌하지 않는 고유 필드 ID를 생성합니다.
 */
function createGeneratedFieldId(prefix: "f" | "f_rel"): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 6)}`;
}

/**
 * 필드 ID 또는 label과 일치하는지 지능적으로 대조하는 판별 함수
 */
function matchesTargetField(field: CoreFormField, targetIdentifier?: string): boolean {
  if (!targetIdentifier) return false;
  const normTarget = targetIdentifier.trim().toLowerCase().replace(/\s+/g, "");
  const normId = field.id.trim().toLowerCase().replace(/\s+/g, "");
  const normLabel = field.label.trim().toLowerCase().replace(/\s+/g, "");

  return (
    normId === normTarget ||
    normLabel === normTarget ||
    normTarget.includes(normLabel) ||
    normLabel.includes(normTarget)
  );
}

/**
 * 빌더 변경/제어 도구 카탈로그에서 사용할 DB 저장소 의존성 인터페이스
 */
export interface BuilderToolsDependencies {
  findFormById: (id: string) => Promise<Form | undefined>;
  hasSubmissionsByFormId?: (formId: string) => Promise<boolean>;
  insertForm: (input: InsertForm) => Promise<Form>;
  updateFormById: (id: string, updates: UpdateForm) => Promise<OptimisticUpdateResult<Form>>;
  publishFormById: (id: string, isPublished: boolean) => Promise<Form | undefined>;
  softDeleteFormsByIds: (ids: string[]) => Promise<Form[]>;
  /** 클라이언트 화면이 현재 보고 있는 폼 ID (낙관적 락 컨텍스트 대조용) */
  expectedFormId?: string | undefined;
  /** 클라이언트 화면이 현재 보고 있는 폼 버전 (낙관적 락 컨텍스트 대조용) */
  expectedFormVersion?: number | undefined;
}

/**
 * 대상 폼이 과거 응답 데이터 무결성 보호 대상인지 판별합니다.
 *
 * 현재 공식 발행 상태(publishedAt !== null)이거나,
 * 발행 취소 후라도 이미 제출된 응답 데이터가 1건 이상 존재하면 true를 반환하여
 * 필드 및 옵션의 물리 삭제를 원천 차단하고 소프트 삭제/비활성화로 보존합니다.
 *
 * @param form 검사 대상 폼 엔티티
 * @param deps 저장소 의존성
 * @returns 보호 대상 여부 (true: 소프트 보존 강제, false: 초기 초안 물리 삭제 허용)
 */
async function isFormHistoryProtected(
  form: Form,
  deps: BuilderToolsDependencies
): Promise<boolean> {
  if (form.publishedAt !== null && form.publishedAt !== undefined) {
    return true;
  }
  if (deps.hasSubmissionsByFormId) {
    return await deps.hasSubmissionsByFormId(form.id);
  }
  return false;
}

/**
 * 공식 발행 중인 폼에 대한 스키마·옵션 직접 수정을 차단하고,
 * 에이전트가 사용자 동의 없이 임의로 발행을 취소하지 않도록 확인 안내를 반환합니다.
 *
 * @param form 검사 대상 폼 엔티티
 * @param targetLabel 수정 대상 구분 ("스키마" | "옵션")
 * @returns 발행 중이면 실패 응답 객체, 미발행(초안)이면 null
 */
function ensureDraftForSchemaEdit(
  form: Form,
  targetLabel: "스키마" | "옵션"
): { success: false; error: string } | null {
  if (form.publishedAt !== null && form.publishedAt !== undefined) {
    return {
      success: false,
      error: `현재 공식 발행 중인 폼의 ${targetLabel}는 직접 수정할 수 없습니다. 사용자 확인 없이 임의로 발행을 취소(publishForm)하지 말고, 먼저 사용자에게 '현재 발행 중인 상태이므로 발행을 취소(초안 회수)한 뒤 수정할까요?'라고 질문해 명시적 승인을 받으세요.`,
    };
  }
  return null;
}

/**
 * AI Builder Navigator Vercel AI SDK 도구 카탈로그 생성 팩토리 함수
 *
 * 폼 조회(searchForms, getFormDetails)는 공통 queryTools가 전담하므로,
 * 본 도구 모음은 화면 이동 및 폼 생성/수정/삭제/발행 액션만 담당합니다.
 */
export function createBuilderTools(deps: BuilderToolsDependencies) {
  let trackedClientFormVersion = deps.expectedFormVersion;

  /**
   * 폼 스키마 수정 전 발행 잠금·데이터 호환성·낙관적 락을 일괄 검증하고 영속화하는 공통 헬퍼
   */
  const persistFormUpdateWithGuards = async (params: {
    existing: Form;
    title?: string | undefined;
    schemaDefinition: { primaryFieldId: string; fields: CoreFormField[] };
    hasSubmissions?: boolean | undefined;
  }): Promise<{ data: Form; error: null } | { data: null; error: string }> => {
    const { existing, title, schemaDefinition } = params;

    // 1. 발행 상태 및 기제출 응답 호환성 검증
    const hasSubmissions =
      params.hasSubmissions ??
      (existing.publishedAt === null && deps.hasSubmissionsByFormId
        ? await deps.hasSubmissionsByFormId(existing.id)
        : false);

    const transitionCheck = validateFormSchemaTransition({
      existingForm: existing,
      nextSchemaDefinition: schemaDefinition,
      hasSubmissions,
    });
    if (transitionCheck.error !== null) {
      return { data: null, error: transitionCheck.error };
    }

    // 2. 클라이언트가 보고 있던 버전과 DB 최신 버전 간 낙관적 락 선제 대조
    if (
      deps.expectedFormId === existing.id &&
      trackedClientFormVersion !== undefined &&
      existing.version !== trackedClientFormVersion
    ) {
      return {
        data: null,
        error:
          "다른 사용자가 먼저 폼을 수정했습니다. 화면을 새로고침해 최신 스키마를 확인한 뒤 다시 요청해 주세요.",
      };
    }

    // 3. DB 레벨 원자적 낙관적 락 업데이트
    const updateResult = await deps.updateFormById(existing.id, {
      ...(title !== undefined ? { title } : {}),
      schemaDefinition,
      expectedVersion: existing.version,
    });

    if (updateResult.status === "not_found") {
      return { data: null, error: `수정 대상 폼('${existing.id}')을 찾을 수 없습니다.` };
    }
    if (updateResult.status === "conflict") {
      return {
        data: null,
        error:
          "다른 사용자가 동시에 폼을 수정했습니다. 화면을 새로고침해 최신 버전을 확인한 뒤 다시 시도해 주세요.",
      };
    }

    if (deps.expectedFormId === existing.id) {
      trackedClientFormVersion = updateResult.data.version;
    }

    return { data: updateResult.data, error: null };
  };

  const navigateTool = tool({
    description:
      "애플리케이션 내의 다른 화면으로 이동합니다. 폼 목록(/builder/forms), 라이브 캔버스(/builder/forms/[id]) 등으로 이동할 때 호출합니다.",
    inputSchema: navigateInputSchema,
    execute: async ({ targetPath, reason }: NavigateInput) => {
      const action: NavigatorBuilderAction = {
        type: "NAVIGATE",
        targetPath,
        message: reason ?? "해당 화면으로 이동합니다.",
      };
      return {
        success: true,
        targetPath,
        reason: reason ?? "화면 이동",
        clientAction: action,
      };
    },
  });

  const createFormTool = tool({
    description:
      "새로운 폼을 생성하고 데이터베이스에 영속화합니다. 폼 생성 후 즉시 해당 폼의 라이브 캔버스(/builder/forms/[id])로 이동하도록 처리됩니다.",
    inputSchema: createFormInputSchema,
    execute: async ({ title, description, primaryFieldId, fields }: CreateFormInput) => {
      const created = await deps.insertForm({
        title,
        description: description ?? null,
        schemaDefinition: { primaryFieldId, fields },
      });

      const action: NavigatorBuilderAction = {
        type: "CREATE_FORM",
        formId: created.id,
        title: created.title,
        description: created.description ?? undefined,
        primaryFieldId: extractPrimaryFieldId(created) ?? primaryFieldId,
        fields: extractFieldsFromForm(created),
        message: `새로운 폼 '${created.title}'을 생성했습니다.`,
      };

      return {
        success: true,
        form: created,
        targetPath: `/builder/forms/${created.id}`,
        clientAction: action,
      };
    },
  });

  const updateSchemaTool = tool({
    description:
      "기존 폼의 필드를 추가, 수정, 삭제하거나 전체 필드를 일괄 교체(SET_ALL_FIELDS), 대표 식별 필드 변경(SET_PRIMARY_FIELD)을 수행합니다.",
    inputSchema: updateSchemaInputSchema,
    execute: async ({
      formId,
      operation,
      targetFieldId,
      primaryFieldId: inputPrimaryFieldId,
      fieldData,
      fields: newFieldsList,
      formTitle,
    }: UpdateSchemaInput) => {
      const existing = await deps.findFormById(formId);
      if (!existing) {
        return {
          success: false,
          error: `수정 대상 폼('${formId}')을 찾을 수 없습니다.`,
        };
      }

      const publishLockError = ensureDraftForSchemaEdit(existing, "스키마");
      if (publishLockError) {
        return publishLockError;
      }

      const currentFields = extractFieldsFromForm(existing);
      const existingPrimaryFieldId = extractPrimaryFieldId(existing);
      let nextPrimaryFieldId: string | undefined = existingPrimaryFieldId;
      const isProtected = await isFormHistoryProtected(existing, deps);
      let updatedFields: CoreFormField[] = [...currentFields];

      if (operation === "SET_ALL_FIELDS") {
        if (!newFieldsList || newFieldsList.length === 0) {
          return {
            success: false,
            error: "SET_ALL_FIELDS 오퍼레이션에는 최소 1개 이상의 완성된 fields 배열이 필수입니다.",
          };
        }

        const currentFieldMap = new Map(currentFields.map((f) => [f.id, f]));

        // 보호 대상 폼(발행 이후 또는 기제출 응답 보유)에서는 선택형 필드의 누락된 기존 옵션도 disabled: true로 보존 병합합니다.
        const mergedNewFields: CoreFormField[] = newFieldsList.map((newField) => {
          if (!isProtected) {
            return newField;
          }
          const existingField = currentFieldMap.get(newField.id);
          if (
            existingField &&
            (newField.type === "select" ||
              newField.type === "radio" ||
              newField.type === "checkbox") &&
            existingField.options
          ) {
            return {
              ...newField,
              options: mergeOptionsWithPreservation(existingField.options, newField.options),
            };
          }
          return newField;
        });

        if (isProtected) {
          const nowIso = nowUtcIso();
          const newFieldIdSet = new Set(mergedNewFields.map((f) => f.id));

          // 보호 대상 폼에서는 누락된 기존 필드를 물리 삭제하지 않고 deletedAt을 부여하여 영구 보존합니다.
          const preservedDeletedFields: CoreFormField[] = currentFields
            .filter((oldField) => !newFieldIdSet.has(oldField.id))
            .map((oldField) => ({
              ...oldField,
              deletedAt: oldField.deletedAt ?? nowIso,
            }));

          updatedFields = [...mergedNewFields, ...preservedDeletedFields];
        } else {
          // 미발행 초기 빌드 상태(응답 0건)에서는 누락된 기존 필드를 깔끔하게 물리 삭제합니다.
          updatedFields = mergedNewFields;
        }

        // SET_ALL_FIELDS에서 대체 primaryFieldId가 전달된 경우 새 활성 필드 ID로 해석하여 갱신합니다.
        if (inputPrimaryFieldId && inputPrimaryFieldId.trim().length > 0) {
          const matchedPrimary = mergedNewFields.find((f) =>
            matchesTargetField(f, inputPrimaryFieldId)
          );
          nextPrimaryFieldId = matchedPrimary ? matchedPrimary.id : inputPrimaryFieldId;
        }
      } else if (operation === "SET_PRIMARY_FIELD") {
        const candidateIdentifier = inputPrimaryFieldId ?? targetFieldId;
        if (!candidateIdentifier || candidateIdentifier.trim().length === 0) {
          return {
            success: false,
            error:
              "SET_PRIMARY_FIELD 오퍼레이션에는 변경할 대표 필드 ID 또는 라벨(primaryFieldId)이 필수입니다.",
          };
        }

        const activeFields = extractActiveFields(existing);
        const matched = activeFields.find((f) => matchesTargetField(f, candidateIdentifier));
        if (!matched) {
          return {
            success: false,
            error: `대표 필드로 지정할 활성 필드('${candidateIdentifier}')를 찾을 수 없습니다.`,
          };
        }

        nextPrimaryFieldId = matched.id;
      } else if (operation === "ADD_FIELD") {
        if (
          !fieldData ||
          !fieldData.label ||
          !fieldData.type ||
          !fieldData.description ||
          fieldData.description.trim().length === 0
        ) {
          return {
            success: false,
            error: "필드 추가 시 label, type, description은 필수입니다.",
          };
        }
        const newField: CoreFormField = {
          id: fieldData.id ?? createGeneratedFieldId("f"),
          label: fieldData.label,
          type: fieldData.type,
          required: fieldData.required ?? false,
          ...(fieldData.multiple !== undefined ? { multiple: fieldData.multiple } : {}),
          placeholder: fieldData.placeholder ?? undefined,
          description: fieldData.description.trim(),
          options: fieldData.options ?? undefined,
          relationConfig: fieldData.relationConfig ?? undefined,
        };
        updatedFields.push(newField);
      } else if (operation === "REMOVE_FIELD") {
        if (!targetFieldId) {
          return {
            success: false,
            error: "필드 삭제 시 대상 targetFieldId는 필수입니다.",
          };
        }

        // 현재 도메인의 대표 식별 필드(primaryFieldId)는 직접 삭제할 수 없도록 선제 차단합니다.
        const activeTarget = currentFields.find(
          (f) => !f.deletedAt && matchesTargetField(f, targetFieldId)
        );
        if (activeTarget && existingPrimaryFieldId && activeTarget.id === existingPrimaryFieldId) {
          return {
            success: false,
            error: `현재 폼의 대표 필드('${activeTarget.label}', ID: ${activeTarget.id})는 삭제할 수 없습니다. 먼저 'SET_PRIMARY_FIELD' 오퍼레이션으로 다른 활성 필드를 대표 필드로 변경한 뒤 삭제해 주세요.`,
          };
        }

        if (isProtected) {
          const nowIso = nowUtcIso();
          let targetFound = false;

          // 보호 대상 폼에서는 과거 데이터의 라벨 무결성 보존을 위해 물리 삭제 대신 소프트 삭제(deletedAt)로 처리합니다.
          updatedFields = updatedFields.map((f) => {
            if (matchesTargetField(f, targetFieldId) && !f.deletedAt) {
              targetFound = true;
              return {
                ...f,
                deletedAt: nowIso,
              };
            }
            return f;
          });

          if (!targetFound) {
            return {
              success: false,
              error: `삭제 대상 필드('${targetFieldId}')를 찾을 수 없거나 이미 소프트 삭제된 필드입니다.`,
            };
          }
        } else {
          // 미발행 초기 빌드 상태(응답 0건)에서는 대상 필드를 물리 삭제합니다.
          const initialLength = updatedFields.length;
          updatedFields = updatedFields.filter((f) => !matchesTargetField(f, targetFieldId));

          if (updatedFields.length === initialLength) {
            return {
              success: false,
              error: `삭제 대상 필드('${targetFieldId}')를 찾을 수 없습니다.`,
            };
          }
        }
      } else if (operation === "UPDATE_FIELD") {
        if (!targetFieldId || !fieldData) {
          return {
            success: false,
            error: "필드 수정 시 targetFieldId와 fieldData는 필수입니다.",
          };
        }

        updatedFields = updatedFields.map((f): CoreFormField => {
          if (!matchesTargetField(f, targetFieldId)) return f;

          let resolvedOptions = f.options;
          if (fieldData.options !== undefined) {
            // 보호 대상 폼에서는 옵션 수정 시 누락된 기존 옵션을 disabled: true로 보존 병합합니다.
            resolvedOptions = isProtected
              ? mergeOptionsWithPreservation(f.options, fieldData.options)
              : fieldData.options;
          }

          return {
            ...f,
            ...fieldData,
            label: fieldData.label ?? f.label,
            type: fieldData.type ?? f.type,
            required: fieldData.required ?? f.required,
            multiple: fieldData.multiple !== undefined ? fieldData.multiple : f.multiple,
            placeholder:
              fieldData.placeholder !== undefined ? fieldData.placeholder : f.placeholder,
            description:
              fieldData.description !== undefined ? fieldData.description : f.description,
            options: resolvedOptions,
            relationConfig:
              fieldData.relationConfig !== undefined ? fieldData.relationConfig : f.relationConfig,
            id: f.id,
          };
        });
      }

      // 모든 스키마 변경 후 최종 상태의 대표 필드(primaryFieldId) 무결성을 검증합니다.
      if (!nextPrimaryFieldId) {
        return {
          success: false,
          error:
            "현재 폼에 대표 필드(primaryFieldId)가 지정되어 있지 않습니다. SET_PRIMARY_FIELD로 대표 필드를 먼저 지정해 주세요.",
        };
      }
      const primaryValidation = validatePrimaryFieldSelection(updatedFields, nextPrimaryFieldId);
      if (!primaryValidation.isValid) {
        return {
          success: false,
          error:
            primaryValidation.reason && primaryValidation.reason.includes("대표 필드")
              ? primaryValidation.reason
              : `대표 필드(primaryFieldId) 무결성 검증 실패: ${primaryValidation.reason ?? "활성 필드 중 유효한 대표 필드를 유지해야 합니다."}`,
        };
      }

      const persistResult = await persistFormUpdateWithGuards({
        existing,
        title: formTitle ?? existing.title,
        schemaDefinition: {
          primaryFieldId: nextPrimaryFieldId,
          fields: updatedFields,
        },
        hasSubmissions: isProtected,
      });

      if (persistResult.error !== null) {
        return {
          success: false,
          error: persistResult.error,
        };
      }

      const updated = persistResult.data;

      const action: NavigatorBuilderAction = {
        type: "UPDATE_SCHEMA",
        operation,
        formId: existing.id,
        primaryFieldId: nextPrimaryFieldId,
        field: fieldData as CoreFormField | undefined,
        fields: newFieldsList,
        title: formTitle,
        message: "폼 스키마가 성공적으로 변경되었습니다.",
      };

      return {
        success: true,
        operation,
        updatedForm: updated,
        fieldsCount: updatedFields.length,
        clientAction: action,
      };
    },
  });

  const publishFormTool = tool({
    description: "폼의 공식 발행 상태를 설정하거나 취소(초안 복귀)합니다.",
    inputSchema: publishFormInputSchema,
    execute: async ({ formId, isPublished }: PublishFormInput) => {
      const existing = await deps.findFormById(formId);
      if (!existing) {
        return {
          success: false,
          error: `대상 폼('${formId}')을 찾을 수 없습니다.`,
        };
      }

      // 발행 요청 시 빈 폼 발행 방지 가드레일
      if (isPublished) {
        const activeFields = extractActiveFields(existing);
        if (activeFields.length === 0) {
          return {
            success: false,
            error:
              "최소 1개 이상의 필드가 포함된 폼만 공식 발행할 수 있습니다. 필드를 먼저 추가해 주세요.",
          };
        }
      }

      // 중앙 DB 시계(sql`now()`)를 통해 발행/초안 상태 전이
      const updated = await deps.publishFormById(existing.id, isPublished);
      if (!updated) {
        return {
          success: false,
          error: "폼 발행 상태를 변경하지 못했습니다.",
        };
      }

      const action: NavigatorBuilderAction = {
        type: "PUBLISH_FORM",
        formId,
        isPublished,
        message: isPublished
          ? "폼이 공식 발행되었습니다. 응답자가 작성할 수 있습니다."
          : "폼 발행이 취소되어 초안 상태로 회수되었습니다.",
      };

      return {
        success: true,
        formId,
        isPublished,
        form: updated,
        clientAction: action,
      };
    },
  });

  const deleteFormsTool = tool({
    description: "지정된 ID의 폼을 소프트 삭제합니다.",
    inputSchema: deleteFormsInputSchema,
    execute: async ({ formIds, reason }: DeleteFormsInput) => {
      const deleted = await deps.softDeleteFormsByIds(formIds);

      const action: NavigatorBuilderAction = {
        type: "DELETE_FORMS",
        deletedIds: deleted.map((f) => f.id),
        message: "선택한 폼을 성공적으로 삭제했습니다.",
      };

      return {
        success: true,
        deletedIds: deleted.map((f) => f.id),
        deletedCount: deleted.length,
        reason: reason ?? "사용자 요청에 의한 삭제",
        targetPath: "/builder/forms",
        clientAction: action,
      };
    },
  });

  const addRelationFieldTool = tool({
    description:
      "현재 폼에 다른 도메인 폼을 참조하는 관계형 필드(type: 'relation')를 추가합니다. 타깃 폼의 대표 식별 필드(primaryFieldId)와 테이블 스키마 유효성을 검증하여 연결합니다.",
    inputSchema: addRelationFieldInputSchema,
    execute: async ({
      formId,
      label,
      targetFormId,
      multiple,
      required,
      description,
    }: AddRelationFieldInput) => {
      // 1. 현재 작업 중인 폼 및 대표 필드 유효성 검증
      const currentForm = await deps.findFormById(formId);
      if (!currentForm) {
        return {
          success: false,
          error: `현재 작업 대상 폼('${formId}')을 찾을 수 없습니다.`,
        };
      }

      const publishLockError = ensureDraftForSchemaEdit(currentForm, "스키마");
      if (publishLockError) {
        return publishLockError;
      }

      const currentPrimaryFieldId = extractPrimaryFieldId(currentForm);
      if (!currentPrimaryFieldId) {
        return {
          success: false,
          error:
            "현재 폼에 대표 필드(primaryFieldId)가 지정되어 있지 않습니다. 먼저 SET_PRIMARY_FIELD로 대표 필드를 지정해 주세요.",
        };
      }

      // 2. 참조 대상 타깃 폼 존재 여부 및 타깃 폼의 대표 필드(primaryFieldId) 검증
      const targetForm = await deps.findFormById(targetFormId);
      if (!targetForm) {
        return {
          success: false,
          error: `참조 대상 타깃 폼('${targetFormId}')을 찾을 수 없습니다. 올바른 폼 ID인지 확인해 주세요.`,
        };
      }

      const targetFields = extractFieldsFromForm(targetForm);
      const targetPrimaryFieldId = extractPrimaryFieldId(targetForm);
      const targetPrimaryCheck = validatePrimaryFieldSelection(targetFields, targetPrimaryFieldId);
      if (!targetPrimaryCheck.isValid || !targetPrimaryFieldId) {
        return {
          success: false,
          error: `참조 대상 폼 '${targetForm.title}'에 유효한 대표 식별 필드(primaryFieldId)가 설정되어 있지 않아 관계 필드를 연결할 수 없습니다. (${targetPrimaryCheck.reason ?? "primaryFieldId 누락"})`,
        };
      }

      const currentFields = extractFieldsFromForm(currentForm);
      const newFieldId = createGeneratedFieldId("f_rel");
      const newField: CoreFormField = {
        id: newFieldId,
        label,
        type: "relation",
        required: required ?? false,
        description: description.trim(),
        relationConfig: {
          targetFormId: targetForm.id,
          multiple: multiple ?? false,
        },
      };

      const updatedFields = [...currentFields, newField];
      const persistResult = await persistFormUpdateWithGuards({
        existing: currentForm,
        schemaDefinition: {
          primaryFieldId: currentPrimaryFieldId,
          fields: updatedFields,
        },
      });
      if (persistResult.error !== null) {
        return {
          success: false,
          error: persistResult.error,
        };
      }
      const updated = persistResult.data;

      const action: NavigatorBuilderAction = {
        type: "UPDATE_SCHEMA",
        operation: "ADD_FIELD",
        formId: currentForm.id,
        primaryFieldId: currentPrimaryFieldId,
        field: newField,
        message: `'${targetForm.title}' 폼을 참조하는 관계형 필드 '${label}'을 추가했습니다.`,
      };

      return {
        success: true,
        field: newField,
        targetFormTitle: targetForm.title,
        targetPrimaryFieldId,
        updatedForm: updated,
        clientAction: action,
      };
    },
  });

  const updateFieldOptionsTool = tool({
    description:
      "선택형 필드(select, radio, checkbox)의 옵션 목록을 조작합니다. 과거 데이터 무결성을 위해 삭제 대신 'DISABLE_OPTION'(소프트 비활성화)을 권장합니다.",
    inputSchema: updateFieldOptionsInputSchema,
    execute: async ({
      formId,
      targetFieldId,
      operation,
      options: newOptionsInput,
      targetOptionValue,
    }: UpdateFieldOptionsInput) => {
      const existing = await deps.findFormById(formId);
      if (!existing) {
        return {
          success: false,
          error: `대상 폼('${formId}')을 찾을 수 없습니다.`,
        };
      }

      const publishLockError = ensureDraftForSchemaEdit(existing, "옵션");
      if (publishLockError) {
        return publishLockError;
      }

      const currentFields = extractFieldsFromForm(existing);
      const targetFieldIndex = currentFields.findIndex((f) => matchesTargetField(f, targetFieldId));

      if (targetFieldIndex === -1) {
        return {
          success: false,
          error: `대상 필드('${targetFieldId}')를 폼에서 찾을 수 없습니다.`,
        };
      }

      const targetField = currentFields[targetFieldIndex];
      if (!targetField) {
        return {
          success: false,
          error: `대상 필드('${targetFieldId}')를 폼에서 찾을 수 없습니다.`,
        };
      }

      if (
        targetField.type !== "select" &&
        targetField.type !== "radio" &&
        targetField.type !== "checkbox"
      ) {
        return {
          success: false,
          error: `필드 '${targetField.label}'(타입: ${targetField.type})은 옵션을 지원하는 선택형 필드가 아닙니다.`,
        };
      }

      const isProtected = await isFormHistoryProtected(existing, deps);

      // 기존 옵션 목록을 SelectOption[] 형태로 정리 (설명 필드 포함 정규화)
      const existingOptions = normalizeSelectOptions(targetField.options);

      let updatedOptions: SelectOption[] = [...existingOptions];

      switch (operation) {
        case "DISABLE_OPTION": {
          if (!targetOptionValue) {
            return {
              success: false,
              error: "비활성화할 대상 옵션의 value 또는 label을 targetOptionValue로 전달해 주세요.",
            };
          }
          const normTarget = targetOptionValue.trim().toLowerCase();
          let found = false;
          updatedOptions = updatedOptions.map((opt) => {
            if (opt.value.toLowerCase() === normTarget || opt.label.toLowerCase() === normTarget) {
              found = true;
              return { ...opt, disabled: true };
            }
            return opt;
          });
          if (!found) {
            return {
              success: false,
              error: `옵션 목록에서 '${targetOptionValue}' 항목을 찾지 못했습니다.`,
            };
          }
          break;
        }

        case "ENABLE_OPTION": {
          if (!targetOptionValue) {
            return {
              success: false,
              error: "활성화할 대상 옵션의 value 또는 label을 targetOptionValue로 전달해 주세요.",
            };
          }
          const normTarget = targetOptionValue.trim().toLowerCase();
          updatedOptions = updatedOptions.map((opt) => {
            if (opt.value.toLowerCase() === normTarget || opt.label.toLowerCase() === normTarget) {
              return { ...opt, disabled: false };
            }
            return opt;
          });
          break;
        }

        case "ADD_OPTIONS": {
          if (!newOptionsInput || newOptionsInput.length === 0) {
            return {
              success: false,
              error: "추가할 옵션 목록(options)을 전달해 주세요.",
            };
          }
          const existingValues = new Set(updatedOptions.map((o) => o.value));
          for (const opt of newOptionsInput) {
            if (!existingValues.has(opt.value)) {
              updatedOptions.push(normalizeSelectOption(opt));
              existingValues.add(opt.value);
            }
          }
          break;
        }

        case "REMOVE_OPTION": {
          // 보호 대상 폼(발행 이후 또는 기제출 응답 보유)에서는 옵션 물리 삭제를 원천 차단합니다.
          if (isProtected) {
            return {
              success: false,
              error:
                "이미 발행되었거나 제출 응답이 존재하는 폼의 옵션은 과거 데이터 무결성을 보존하기 위해 삭제할 수 없습니다. 대신 'DISABLE_OPTION'(소프트 비활성화)을 사용해 주세요.",
            };
          }
          if (!targetOptionValue) {
            return {
              success: false,
              error: "삭제할 대상 옵션의 value 또는 label을 targetOptionValue로 전달해 주세요.",
            };
          }
          const normTarget = targetOptionValue.trim().toLowerCase();
          updatedOptions = updatedOptions.filter(
            (opt) =>
              opt.value.toLowerCase() !== normTarget && opt.label.toLowerCase() !== normTarget
          );
          break;
        }

        case "SET_OPTIONS": {
          if (!newOptionsInput) {
            return {
              success: false,
              error: "전체 교체할 옵션 목록(options)을 전달해 주세요.",
            };
          }
          // 보호 대상 폼에서는 새 목록에서 누락된 기존 옵션을 disabled: true로 보존 병합합니다.
          updatedOptions = isProtected
            ? mergeOptionsWithPreservation(existingOptions, newOptionsInput)
            : normalizeSelectOptions(newOptionsInput);
          break;
        }
      }

      const updatedField: CoreFormField = {
        ...targetField,
        options: updatedOptions,
      };

      const updatedFields = [...currentFields];
      updatedFields[targetFieldIndex] = updatedField;

      const currentPrimaryFieldId = extractPrimaryFieldId(existing);
      if (!currentPrimaryFieldId) {
        return {
          success: false,
          error:
            "현재 폼에 대표 필드(primaryFieldId)가 지정되어 있지 않습니다. 먼저 SET_PRIMARY_FIELD로 대표 필드를 지정해 주세요.",
        };
      }

      const persistResult = await persistFormUpdateWithGuards({
        existing,
        schemaDefinition: {
          primaryFieldId: currentPrimaryFieldId,
          fields: updatedFields,
        },
        hasSubmissions: isProtected,
      });
      if (persistResult.error !== null) {
        return {
          success: false,
          error: persistResult.error,
        };
      }
      const updatedForm = persistResult.data;

      const action: NavigatorBuilderAction = {
        type: "UPDATE_SCHEMA",
        operation: "UPDATE_FIELD",
        formId: existing.id,
        primaryFieldId: currentPrimaryFieldId,
        field: updatedField,
        message: `'${targetField.label}' 필드의 옵션을 성공적으로 변경했습니다.`,
      };

      return {
        success: true,
        field: updatedField,
        operation,
        optionsCount: updatedOptions.length,
        updatedForm,
        clientAction: action,
      };
    },
  });

  return {
    navigate: navigateTool,
    createForm: createFormTool,
    updateSchema: updateSchemaTool,
    publishForm: publishFormTool,
    deleteForms: deleteFormsTool,
    addRelationField: addRelationFieldTool,
    updateFieldOptions: updateFieldOptionsTool,
  };
}
