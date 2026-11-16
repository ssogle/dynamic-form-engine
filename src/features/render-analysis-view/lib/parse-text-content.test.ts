import { describe, expect, it } from "vitest";
import { parseInlineSegments, parseTextContent } from "./parse-text-content";

describe("parse-text-content (render-analysis-view/lib)", () => {
  it("빈 문자열 입력 시 빈 배열을 반환한다", () => {
    expect(parseTextContent("   \n  ")).toEqual([]);
  });

  it("제목(h1~h3), 불릿 목록, 일반 단락, 인라인 볼드를 구조화 노드로 안전하게 파싱한다", () => {
    const markdown = [
      "## 핵심 요약",
      "전월 대비 **매출이 25% 상승**했습니다.",
      "",
      "- 1월 매출: 100만원",
      "* 2월 매출: 125만원",
    ].join("\n");

    const nodes = parseTextContent(markdown);
    expect(nodes).toEqual([
      {
        kind: "heading",
        level: 2,
        segments: [{ text: "핵심 요약", bold: false }],
      },
      {
        kind: "paragraph",
        segments: [
          { text: "전월 대비 ", bold: false },
          { text: "매출이 25% 상승", bold: true },
          { text: "했습니다.", bold: false },
        ],
      },
      {
        kind: "bulletList",
        items: [
          [{ text: "1월 매출: 100만원", bold: false }],
          [{ text: "2월 매출: 125만원", bold: false }],
        ],
      },
    ]);
  });

  it("스크립트 태그 등 원시 HTML 문자열도 일반 텍스트로 그대로 보존한다", () => {
    const segments = parseInlineSegments("<script>alert(1)</script>");
    expect(segments).toEqual([{ text: "<script>alert(1)</script>", bold: false }]);
  });
});
