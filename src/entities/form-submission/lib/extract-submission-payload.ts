/**
 * 폼 응답 제출(POST/PATCH) API 요청 본문에서 실제 필드 데이터 맵을 안전하게 추출합니다.
 *
 * 래핑된 `{ data: Record<string, unknown> }` 형태와 평면 Key-Value 객체 형태를 모두 지원하며,
 * 배열·원시값·null 등 비객체 입력은 빈 객체로 안전하게 폴백합니다.
 *
 * @param body JSON 파싱된 요청 본문
 * @returns 필드 ID -> 값 매핑 객체
 */
export function extractSubmissionPayload(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return {};
  }

  if (
    "data" in body &&
    body.data !== null &&
    typeof body.data === "object" &&
    !Array.isArray(body.data)
  ) {
    return body.data as Record<string, unknown>;
  }

  return body as Record<string, unknown>;
}
