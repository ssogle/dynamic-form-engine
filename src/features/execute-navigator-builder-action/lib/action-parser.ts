import { z } from "zod";
import { navigatorActionSchema, type NavigatorAction } from "../schema/action.schema";
import type { ActionResult } from "../types/action.types";

/**
 * 폼 슬러그 문자열을 안전한 kebab-case로 정규화합니다.
 */
export function sanitizeSlug(rawSlug: string): string {
  const cleaned = rawSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned.length > 0 ? cleaned : "form-preview";
}

/**
 * 원시 AI 응답 데이터를 NavigatorAction 유니온 규격으로 검증 및 정제합니다.
 *
 * @param rawInput LLM 구조화 출력 결과 또는 파싱 대상 데이터
 * @returns ActionResult<NavigatorAction> Result 패턴 객체
 */
export function parseNavigatorAction(rawInput: unknown): ActionResult<NavigatorAction> {
  if (!rawInput || typeof rawInput !== "object") {
    return {
      data: null,
      error: {
        code: "INVALID_ACTION_PAYLOAD",
        message: "네비게이터 응답 데이터가 올바른 객체 형태가 아닙니다.",
        details: rawInput,
      },
    };
  }

  // CREATE_FORM인 경우 슬러그 자동 정규화 보정
  const candidate = { ...(rawInput as Record<string, unknown>) };
  if (candidate.type === "CREATE_FORM" && typeof candidate.slug === "string") {
    candidate.slug = sanitizeSlug(candidate.slug);
  }

  const parseResult = navigatorActionSchema.safeParse(candidate);

  if (!parseResult.success) {
    const errorDetails = z.treeifyError(parseResult.error);
    const primaryError = parseResult.error.issues[0]?.message ?? "액션 스키마 검증 실패";

    return {
      data: null,
      error: {
        code: "ACTION_SCHEMA_VALIDATION_ERROR",
        message: `액션 규격 검증 실패: ${primaryError}`,
        details: errorDetails,
      },
    };
  }

  return {
    data: parseResult.data,
    error: null,
  };
}
