# Functional Programming & Coding Paradigm Rule

당신은 높은 가독성과 예측 가능성을 추구하는 함수형 소프트웨어 엔지니어입니다. 본 프로젝트의 모든 코드를 작성할 때는 객체지향의 복잡한 클래스 상속을 배제하고 아래의 함수형 프로그래밍 원칙과 가드레일을 반드시 준수하세요.

---

## 1. 클래스(class) 및 this 사용 금지

본 프로젝트는 순수 함수와 합성(Composition)을 기반으로 동작합니다.

- **클래스 선언 금지**: `class` 키워드 사용을 금지합니다. (ESLint `no-restricted-syntax`에 의해 빌드 및 린트 단계에서 기계적으로 차단됩니다)
- **this 바인딩 금지**: 객체 메서드 내부의 동적 `this` 참조를 금지합니다.
- **대안 패턴**:
  - 데이터 모델: 인터페이스(`interface`) 또는 타입(`type`)으로 순수 데이터 형상만 정의합니다.
  - 로직/인스턴스 생성: 클로저(Closure) 또는 순수 팩토리 함수(Factory Function)를 활용합니다.

```typescript
// [Bad] 클래스 기반 객체지향 상속
class FormValidator {
  private schema: Schema;
  constructor(schema: Schema) {
    this.schema = schema;
  }
  validate(data: unknown) {
    return this.schema.parse(data);
  }
}

// [Good] 순수 함수 및 객체 팩토리 패턴
interface FormValidator {
  validate: (data: unknown) => ValidationResult;
}

export const createFormValidator = (schema: Schema): FormValidator => ({
  validate: (data: unknown) => schema.safeParse(data),
});
```

---

## 2. 불변성(Immutability)과 순수 함수 지향

- **원본 데이터 변이(Mutation) 금지**:
  - 배열 직접 조작(`push`, `splice`, `reverse`) 대신 불변 메서드(`map`, `filter`, `concat`, 스프레드 문법 `[...arr]`)를 사용합니다.
  - 객체 속성 직접 변경(`obj.title = "new"`) 대신 객체 복사(`{ ...obj, title: "new" }`)를 사용합니다.
- **재할당 방지**: `let` 사용을 최소화하고 항상 `const`를 우선 사용합니다. (`var`는 전면 금지)

---

## 3. 비동기 통신 및 정규화된 에러 핸들링

본 프로젝트는 서버와 클라이언트의 런타임 특성에 맞춰 비동기 에러를 체계적으로 정규화하여 다룹니다.

### 1) 클라이언트 비동기 통신 (`httpClient` & TanStack Query)

- **통합 에러 객체 throw**:
  - `httpClient`는 4xx/5xx HTTP 실패 및 네트워크 단절 시, 항상 단일 공통 규격인 `HttpErrorData`(`status`, `code`, `message`, `details`)를 일관되게 `throw`합니다.
- **TanStack Query와의 직통 연동**:
  - 쿼리 함수(`queries/*.query.ts`)는 수동 분기(`if (error) throw`) 없이 `() => httpClient.get<T>(url)` 단 한 줄로 선언합니다.
  - 던져진 `HttpErrorData`는 TanStack Query의 표준 상태 머신(`isError: true`, `error: HttpErrorData`)으로 자동 집결되어, UI 컴포넌트에서는 `if (isError)` 단일 조건문으로 모든 에러를 안전하게 처리합니다.
- **비(非) TanStack Query 환경**:
  - 리액트 바깥에서 직접 `httpClient`를 호출할 때는 `try-catch`를 사용하며, `isHttpError(e)` 타입 가드를 통해 에러 코드별 정밀 분기를 수행합니다.

### 2) 서버 에러 핸들링 (BFF Route Handler)

- **전역 예외 필터 (`withErrorHandler`)**:
  - Route Handler 작성 시 `withErrorHandler` 고차 함수를 감싸서 서버 내부의 모든 예외(`throw badRequest`, 예상치 못한 런타임 예외 등)를 가로챕니다.
  - 서버 프로세스 중단 없이 항상 표준 JSON 에러 포맷(`{ success: false, error: {...} }`)과 적절한 HTTP 상태 코드로 안전하게 변환하여 응답합니다.

---

## 4. 고차 함수(Higher-Order Function)와 함수 합성

- 반복되는 횡단 관심사(로깅, 에러 핸들링, 인증 검증 등)는 클래스 데코레이터나 미들웨어 상속 대신, **함수를 인자로 받아 새 함수를 반환하는 고차 함수**로 해결합니다.
  - 예: `withErrorHandler(async (req) => { ... })`

---

## 5. 데이터 모델링 및 경계선 런타임 검증 원칙 (Zod & Type Governance)

본 프로젝트는 런타임 검증 비용을 최소화하고 타입 안전성을 극대화하기 위해 **"경계선 검증 원칙(Boundary Validation Principle)"**을 준수합니다.

### 1) 경계선(Boundary) 런타임 검증 원칙

Zod의 런타임 유효성 검사(`safeParse`)는 **"신뢰할 수 없는 외부 데이터가 시스템 내부로 유입되는 경계선"**에서만 실행합니다:

- **검증 필수 대상 (Untrusted Boundaries)**:
  1. **사용자 Form 입력**: 브라우저에서 제출된 생성/수정 요청 본문 (오타, 특수문자, 악의적 페이로드 방어)
  2. **AI(LLM) 구조화 응답**: Gemini Structured Outputs로 파싱된 비정형 데이터 (환각, 키 누락, 타입 불일치 방어)
  3. **외부 웹훅/서드파티 API**: 사외 시스템에서 인입되는 비정형 페이로드
- **검증 불필요 대상 (Trusted Internals)**:
  - **데이터베이스 조회 결과 레코드**: 이미 DB 제약조건(PK, NOT NULL 등)과 초기 검증을 거쳐 영속화된 신뢰 데이터입니다. 내부 DB 조회 결과에 불필요하게 Zod 런타임 검증을 반복 실행하는 CPU/메모리 오버헤드를 금지합니다.

### 2) 조회(Read) 모델 타이핑 규칙

- DB 엔티티 조회 모델(`Form`, `Submission` 등)은 Drizzle ORM의 테이블 정의로부터 직접 자동 추론되는 **`typeof table.$inferSelect`**를 단일 원천(SSOT)으로 사용합니다.
- Drizzle 드라이버가 반환하는 실제 쿼리 결과 객체와 1:1로 일치하여 타입 불일치(TS2322) 결함을 방지합니다.

```typescript
// [Good] DB 원천 정적 타입 단일화
export type Form = typeof forms.$inferSelect;
```

### 3) 입력/수정(Write) 모델 타이핑 규칙

- 클라이언트가 서버로 전송하는 생성/수정 요청 모델(`InsertForm`, `UpdateForm` 등)은 비즈니스 검증 규칙(최소 글자 수, 정규식 패턴 등)이 포함된 Zod 스키마로부터 **`z.infer<typeof schema>`**로 파생합니다.
- 프론트엔드 입력 폼(React Hook Form)과 백엔드 Route Handler 양쪽에서 동일한 스키마를 공유하여 이중 방어막을 형성합니다.

```typescript
// [Good] Zod 검증 스키마로부터 비즈니스 입력 타입 파생
export const insertFormSchema = createInsertSchema(forms, {
  slug: (schema) => schema.min(2).regex(/^[a-z0-9-]+$/),
  title: (schema) => schema.min(1),
});

export type InsertForm = z.infer<typeof insertFormSchema>;
export type UpdateForm = z.infer<typeof updateFormSchema>;
```

---

## 6. YAGNI 원칙과 실용적 미니멀리즘 (Pragmatic Minimalism)

본 프로젝트는 불필요한 기술 부채와 유지보수 비용을 차단하기 위해 **YAGNI(You Aren't Gonna Need It)** 철학을 철저히 준수합니다.

### 1) 추측성 코딩(Speculative Coding) 금지

- 현재 활성 스펙(`docs/specs/active/`)이나 테스트 케이스에 명시되지 않은 "미래에 혹시 필요할지도 모르는 기능"을 선제적으로 구현하지 않습니다.
- 사용되지 않는 옵션 파라미터, 호출처 없는 유틸리티 함수, 막연한 확장성용 설정 객체를 코드베이스에 남겨두지 마세요.

### 2) 조기 추상화(Premature Abstraction) 경계

- 동일한 비즈니스 로직이나 패턴이 실제로 3회 이상 중복(Rule of Three)되기 전까지는 섣부른 조기 추상화(복잡한 제네릭, 팩토리 계층, 플러그인 인터페이스)를 도입하지 않습니다.
- 중복보다 나쁜 것은 잘못된 추상화(Wrong Abstraction)입니다. 현재 요구사항을 가장 직관적이고 읽기 쉽게 해결하는 최소한의 코드를 작성하세요.
