import { describe, it, expect } from "vitest";
import type { SelectOption } from "../schema/form-field.schema";
import { mergeOptionsWithPreservation } from "./merge-options-with-preservation";

describe("mergeOptionsWithPreservation (entities/form/lib)", () => {
  const existingOptions: SelectOption[] = [
    { label: "식대", value: "MEAL", description: "임직원 및 업무 중 식사 비용", disabled: false },
    {
      label: "교통비",
      value: "TRANSPORT",
      description: "출장 및 외근 시 대중교통/택시 이용 비용",
      disabled: false,
    },
    {
      label: "숙박비(구)",
      value: "LODGING",
      description: "과거 출장 숙박비 정산용 비활성 항목",
      disabled: true,
    },
  ];

  it("existingOptions와 nextOptions가 모두 null 또는 undefined인 경우 빈 배열을 반환해야 한다", () => {
    expect(mergeOptionsWithPreservation(null, null)).toEqual([]);
    expect(mergeOptionsWithPreservation(undefined, undefined)).toEqual([]);
  });

  it("기존 옵션이 비어있으면 새 옵션 목록을 그대로 정규화하여 반환해야 한다", () => {
    const nextOptions: SelectOption[] = [
      {
        label: "도서비",
        value: "BOOK",
        description: "직무 관련 서적 구입 비용",
        disabled: false,
      },
    ];
    expect(mergeOptionsWithPreservation([], nextOptions)).toEqual([
      {
        label: "도서비",
        value: "BOOK",
        description: "직무 관련 서적 구입 비용",
        disabled: false,
      },
    ]);
  });

  it("새 옵션 목록에서 누락된 기존 옵션은 삭제하지 않고 disabled: true 상태와 description을 보존 병합해야 한다", () => {
    const nextOptions: SelectOption[] = [
      { label: "식대", value: "MEAL", description: "임직원 및 업무 중 식사 비용", disabled: false },
      { label: "도서비", value: "BOOK", description: "직무 관련 서적 구입 비용", disabled: false },
    ];

    const result = mergeOptionsWithPreservation(existingOptions, nextOptions);

    expect(result).toEqual([
      { label: "식대", value: "MEAL", description: "임직원 및 업무 중 식사 비용", disabled: false },
      { label: "도서비", value: "BOOK", description: "직무 관련 서적 구입 비용", disabled: false },
      {
        label: "교통비",
        value: "TRANSPORT",
        description: "출장 및 외근 시 대중교통/택시 이용 비용",
        disabled: true,
      },
      {
        label: "숙박비(구)",
        value: "LODGING",
        description: "과거 출장 숙박비 정산용 비활성 항목",
        disabled: true,
      },
    ]);
  });

  it("기존에 비활성화(disabled: true)되었던 옵션을 새 목록에서 disabled: false로 포함하면 중복 없이 재활성화되어야 한다", () => {
    const nextOptions: SelectOption[] = [
      { label: "식대", value: "MEAL", description: "임직원 및 업무 중 식사 비용", disabled: false },
      {
        label: "교통비",
        value: "TRANSPORT",
        description: "출장 및 외근 시 대중교통/택시 이용 비용",
        disabled: false,
      },
      {
        label: "숙박비",
        value: "LODGING",
        description: "국내외 출장 숙박 비용",
        disabled: false,
      },
    ];

    const result = mergeOptionsWithPreservation(existingOptions, nextOptions);

    expect(result).toEqual([
      { label: "식대", value: "MEAL", description: "임직원 및 업무 중 식사 비용", disabled: false },
      {
        label: "교통비",
        value: "TRANSPORT",
        description: "출장 및 외근 시 대중교통/택시 이용 비용",
        disabled: false,
      },
      {
        label: "숙박비",
        value: "LODGING",
        description: "국내외 출장 숙박 비용",
        disabled: false,
      },
    ]);
  });

  it("새 옵션 목록이 빈 배열([]) 또는 null로 전달되더라도 기존 옵션들이 모두 disabled: true로 보존되어야 한다", () => {
    expect(mergeOptionsWithPreservation(existingOptions, [])).toEqual([
      { label: "식대", value: "MEAL", description: "임직원 및 업무 중 식사 비용", disabled: true },
      {
        label: "교통비",
        value: "TRANSPORT",
        description: "출장 및 외근 시 대중교통/택시 이용 비용",
        disabled: true,
      },
      {
        label: "숙박비(구)",
        value: "LODGING",
        description: "과거 출장 숙박비 정산용 비활성 항목",
        disabled: true,
      },
    ]);

    expect(mergeOptionsWithPreservation(existingOptions, null)).toEqual([
      { label: "식대", value: "MEAL", description: "임직원 및 업무 중 식사 비용", disabled: true },
      {
        label: "교통비",
        value: "TRANSPORT",
        description: "출장 및 외근 시 대중교통/택시 이용 비용",
        disabled: true,
      },
      {
        label: "숙박비(구)",
        value: "LODGING",
        description: "과거 출장 숙박비 정산용 비활성 항목",
        disabled: true,
      },
    ]);
  });
});
