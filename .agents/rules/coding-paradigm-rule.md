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
