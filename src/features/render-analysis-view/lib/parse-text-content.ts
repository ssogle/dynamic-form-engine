/**
 * 인라인 텍스트 세그먼트 (굵게 강조 또는 일반 텍스트)
 */
export interface TextInlineSegment {
  text: string;
  bold: boolean;
}

/**
 * 안전하게 파싱된 텍스트 블록 구조 노드
 */
export type ParsedTextNode =
  | { kind: "heading"; level: 1 | 2 | 3; segments: TextInlineSegment[] }
  | { kind: "bulletList"; items: TextInlineSegment[][] }
  | { kind: "paragraph"; segments: TextInlineSegment[] };

/**
 * 인라인 `**강조**` 문법을 XSS 위험 없는 구조화 세그먼트 배열로 파싱합니다.
 */
export function parseInlineSegments(line: string): TextInlineSegment[] {
  const segments: TextInlineSegment[] = [];
  const boldRegex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = boldRegex.exec(line);

  while (match !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: line.slice(lastIndex, match.index), bold: false });
    }
    const boldText = match[1];
    if (boldText) {
      segments.push({ text: boldText, bold: true });
    }
    lastIndex = match.index + match[0].length;
    match = boldRegex.exec(line);
  }

  if (lastIndex < line.length) {
    segments.push({ text: line.slice(lastIndex), bold: false });
  }

  return segments.length > 0 ? segments : [{ text: line, bold: false }];
}

/**
 * 텍스트 분석 블록의 경량 마크다운 본문을 안전한 AST 노드 배열로 파싱합니다.
 * HTML 태그 주입(dangerouslySetInnerHTML) 없이 React JSX 요소로 안전하게 렌더링하기 위해 사용됩니다.
 *
 * 지원 구문:
 * - `# `, `## `, `### ` 제목
 * - `- `, `* ` 불릿 목록
 * - 일반 단락 및 `**강조**` 인라인 볼드
 */
export function parseTextContent(content: string): ParsedTextNode[] {
  if (!content.trim()) {
    return [];
  }

  const lines = content.split(/\r?\n/);
  const nodes: ParsedTextNode[] = [];
  let bulletBuffer: TextInlineSegment[][] = [];
  let paragraphBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length > 0) {
      nodes.push({ kind: "bulletList", items: bulletBuffer });
      bulletBuffer = [];
    }
  };

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      nodes.push({
        kind: "paragraph",
        segments: parseInlineSegments(paragraphBuffer.join(" ")),
      });
      paragraphBuffer = [];
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (trimmed.length === 0) {
      flushBullets();
      flushParagraph();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch && headingMatch[1] && headingMatch[2]) {
      flushBullets();
      flushParagraph();
      const level = headingMatch[1].length as 1 | 2 | 3;
      nodes.push({
        kind: "heading",
        level,
        segments: parseInlineSegments(headingMatch[2]),
      });
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch && bulletMatch[1]) {
      flushParagraph();
      bulletBuffer.push(parseInlineSegments(bulletMatch[1]));
      continue;
    }

    flushBullets();
    paragraphBuffer.push(trimmed);
  }

  flushBullets();
  flushParagraph();

  return nodes;
}
