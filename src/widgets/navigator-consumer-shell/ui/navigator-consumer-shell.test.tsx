import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NavigatorConsumerShell } from "./navigator-consumer-shell";

describe("NavigatorConsumerShell (widgets/navigator-consumer-shell)", () => {
  it("기본 웰컴 메시지와 입력창이 화면에 렌더링되어야 한다", () => {
    render(<NavigatorConsumerShell />);

    expect(screen.getByText("AI Navigator")).toBeDefined();
    expect(screen.getByText("Consumer")).toBeDefined();
    expect(screen.getByText(/안녕하세요! Consumer AI Navigator입니다/)).toBeDefined();
    expect(screen.getByPlaceholderText(/입사 지원서 작성하고 싶어/)).toBeDefined();
  });

  it("사용자가 메시지를 입력하고 전송하면 사용자 메시지가 화면에 추가되어야 한다", () => {
    render(<NavigatorConsumerShell />);

    const input = screen.getByPlaceholderText(/입사 지원서 작성하고 싶어/);
    const submitButton = screen.getByRole("button", { name: "전송" });

    fireEvent.change(input, { target: { value: "설문 작성 도와줘" } });
    fireEvent.click(submitButton);

    expect(screen.getByText("설문 작성 도와줘")).toBeDefined();
  });
});
