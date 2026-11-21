import { vi } from "vitest";

// 서버 전용(server-only) 모듈을 Node 테스트 환경에서 모킹하여 예외 발생 방지
vi.mock("server-only", () => ({}));
