import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// 서버 전용(server-only) 모듈을 테스트 환경에서 모킹하여 예외 발생 방지
vi.mock("server-only", () => ({}));

// jsdom 환경에서 지원되지 않는 DOM API 폴리필 모킹
window.HTMLElement.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  cleanup();
});
