// commitlint.config.mjs
const Configuration = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // 커밋 타입 허용 목록 정의
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "refactor", "style", "perf", "docs", "test", "chore"],
    ],
    // 제목 끝 마침표 금지 (규칙 준수)
    "subject-full-stop": [2, "never", "."],
    // 한글 커밋 메시지 허용 (대소문자 강제 해제)
    "subject-case": [0],
  },
};

export default Configuration;
