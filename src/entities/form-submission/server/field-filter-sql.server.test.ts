import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FormSchemaDefinition } from "@/shared/tables";

const mockLimit = vi.fn();
const mockWhere = vi.fn(() => ({ limit: mockLimit }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

vi.mock("@/shared/db/server", () => ({
  db: {
    select: mockSelect,
  },
}));

const { buildFieldFilterSqlConditions, buildSafeNumericSql } =
  await import("./field-filter-sql.server");

describe("Field Filter SQL Builder (field-filter-sql.server)", () => {
  const dialect = new PgDialect();
  const targetFormId = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";

  const schemaDefinition: FormSchemaDefinition = {
    primaryFieldId: "f_title",
    fields: [
      { id: "f_title", label: "제목", type: "text", required: true },
      { id: "f_amount", label: "금액", type: "number", required: true },
      {
        id: "f_category",
        label: "카테고리",
        type: "select",
        options: [
          { label: "식대", value: "MEAL", description: "식사", disabled: false },
          { label: "구형항목", value: "LEGACY", description: "과거 분류", disabled: true },
        ],
      },
      {
        id: "f_tags",
        label: "태그",
        type: "checkbox",
        options: [
          { label: "긴급", value: "URGENT", description: "긴급", disabled: false },
          { label: "중요", value: "IMPORTANT", description: "중요", disabled: false },
        ],
      },
      { id: "f_agree", label: "동의", type: "checkbox" },
      { id: "f_switch", label: "승인", type: "switch" },
      { id: "f_date", label: "결제일", type: "date" },
      {
        id: "f_project",
        label: "프로젝트",
        type: "relation",
        relationConfig: { targetFormId, multiple: false },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("buildSafeNumericSql은 콤마 제거 및 정규식 검증 후 double precision 캐스팅 표현식을 생성해야 한다", () => {
    const query = dialect.sqlToQuery(buildSafeNumericSql("f_amount"));
    expect(query.sql).toContain("double precision");
    expect(query.params).toContain("f_amount");
  });

  it("미존재 필드 또는 필드 타입에서 허용하지 않는 연산자 전달 시 Result error를 반환해야 한다", async () => {
    const unknownRes = await buildFieldFilterSqlConditions({
      filters: [{ fieldId: "f_unknown", op: "eq", value: "x" }],
      schemaDefinition,
    });
    expect(unknownRes.conditions).toBeNull();
    expect(unknownRes.error).toContain("존재하지 않습니다");

    const disallowedRes = await buildFieldFilterSqlConditions({
      filters: [{ fieldId: "f_title", op: "between", min: "a", max: "z" }],
      schemaDefinition,
    });
    expect(disallowedRes.conditions).toBeNull();
    expect(disallowedRes.error).toContain("사용할 수 없습니다");
  });

  it("text/number/date/switch/checkbox/select/system 컬럼 조건을 정확한 PostgreSQL SQL로 조립해야 한다", async () => {
    const res = await buildFieldFilterSqlConditions({
      filters: [
        { fieldId: "f_title", op: "neq", value: "테스트" },
        { fieldId: "f_amount", op: "between", min: 1000, max: 5000 },
        { fieldId: "f_category", op: "notIn", values: ["식대", "LEGACY"] },
        { fieldId: "f_tags", op: "hasAll", values: ["긴급", "중요"] },
        { fieldId: "f_agree", op: "eq", value: true },
        { fieldId: "f_switch", op: "isEmpty" },
        { fieldId: "f_date", op: "gte", value: "2026-10-01" },
        { fieldId: "createdAt", op: "between", min: "2026-10-01", max: "2026-10-31" },
      ],
      schemaDefinition,
      timezone: "Asia/Seoul",
    });

    expect(res.error).toBeNull();
    expect(res.conditions).toHaveLength(8);

    const compiledSqls = res.conditions!.map((c) => dialect.sqlToQuery(c));
    // neq는 NULL 보존을 위해 IS DISTINCT FROM 사용
    expect(compiledSqls[0]?.sql).toContain("IS DISTINCT FROM");
    // number between은 double precision BETWEEN 사용
    expect(compiledSqls[1]?.sql).toContain("BETWEEN");
    expect(compiledSqls[1]?.sql).toContain("double precision");
    // notIn은 라벨('식대'->'MEAL') 및 disabled 옵션('LEGACY') 치환 + NULL 보존 포함
    expect(compiledSqls[2]?.sql).toContain("IS NULL");
    expect(compiledSqls[2]?.params).toContain("MEAL");
    expect(compiledSqls[2]?.params).toContain("LEGACY");
    // hasAll은 AND 결합
    expect(compiledSqls[3]?.sql).toContain("and");
    // boolean eq는 true 문자열 비교
    expect(compiledSqls[4]?.params).toContain("true");
    // isEmpty는 NULL/빈 배열/빈 문자열 검사
    expect(compiledSqls[5]?.sql).toContain("jsonb_array_length");
    // date gte는 ::date 캐스팅
    expect(compiledSqls[6]?.sql).toContain("::date");
    // createdAt between은 AT TIME ZONE 적용
    expect(compiledSqls[7]?.sql).toContain("AT TIME ZONE");
  });

  it("동일 필드 내 복수 eq/in 조건은 OR로, 범위와 혼합 시에는 AND로 결합해야 한다", async () => {
    const res = await buildFieldFilterSqlConditions({
      filters: [
        { fieldId: "f_category", value: "식대" },
        { fieldId: "f_category", value: "LEGACY" },
        { fieldId: "f_amount", op: "gte", value: 100 },
        { fieldId: "f_amount", op: "lte", value: 500 },
      ],
      schemaDefinition,
    });

    expect(res.error).toBeNull();
    // f_category 1개 OR 묶음 + f_amount gte + f_amount lte = 총 3개 최상위 AND 조건
    expect(res.conditions).toHaveLength(3);
    const categoryQuery = dialect.sqlToQuery(res.conditions![0]!);
    expect(categoryQuery.sql.toLowerCase()).toContain(" or ");
  });

  it("relation 필드의 contains 자연어 검색 시 타깃 폼 대표 필드 ILIKE로 후보 UUID를 해석해야 한다", async () => {
    const targetSubId1 = "11111111-1111-4111-8111-111111111111";
    const targetSubId2 = "22222222-2222-4222-8222-222222222222";

    mockLimit
      .mockResolvedValueOnce([
        {
          id: targetFormId,
          schemaDefinition: {
            primaryFieldId: "p_name",
            fields: [{ id: "p_name", type: "text", label: "프로젝트명" }],
          },
        },
      ])
      .mockResolvedValueOnce([{ id: targetSubId1 }, { id: targetSubId2 }]);

    const res = await buildFieldFilterSqlConditions({
      filters: [{ fieldId: "f_project", op: "contains", value: "마케팅" }],
      schemaDefinition,
    });

    expect(res.error).toBeNull();
    expect(res.conditions).toHaveLength(1);
    const compiled = dialect.sqlToQuery(res.conditions![0]!);
    expect(compiled.params).toContain(targetSubId1);
    expect(compiled.params).toContain(targetSubId2);
  });

  it("relation 필드의 in 연산자에 UUID가 전달되면 타깃 폼 추가 조회 없이 즉시 조건을 생성해야 한다", async () => {
    const targetSubId = "11111111-1111-4111-8111-111111111111";

    const res = await buildFieldFilterSqlConditions({
      filters: [{ fieldId: "f_project", op: "in", values: [targetSubId] }],
      schemaDefinition,
    });

    expect(res.error).toBeNull();
    expect(mockSelect).not.toHaveBeenCalled();
    expect(res.conditions).toHaveLength(1);
    expect(dialect.sqlToQuery(res.conditions![0]!).params).toContain(targetSubId);
  });

  it("시스템 id 필드의 in 연산자에 UUID 배열이 전달되면 IN 조건 SQL을 생성하고 유효한 UUID가 없으면 FALSE를 반환해야 한다", async () => {
    const id1 = "11111111-1111-4111-8111-111111111111";
    const id2 = "22222222-2222-4222-8222-222222222222";

    const validRes = await buildFieldFilterSqlConditions({
      filters: [{ fieldId: "id", op: "in", values: [id1, id2] }],
      schemaDefinition,
    });
    expect(validRes.error).toBeNull();
    expect(validRes.conditions).toHaveLength(1);
    const compiledValid = dialect.sqlToQuery(validRes.conditions![0]!);
    expect(compiledValid.params).toContain(id1);
    expect(compiledValid.params).toContain(id2);

    const invalidOnlyRes = await buildFieldFilterSqlConditions({
      filters: [{ fieldId: "id", op: "in", values: ["not-a-uuid"] }],
      schemaDefinition,
    });
    expect(invalidOnlyRes.error).toBeNull();
    expect(invalidOnlyRes.conditions).toHaveLength(1);
    expect(dialect.sqlToQuery(invalidOnlyRes.conditions![0]!).sql).toBe("FALSE");
  });
});
