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

## 3. 비동기 통신 및 Result 패턴 (`{ data, error }`)

- **클라이언트 비동기 통신**:
  - 무분별한 `try-catch` 폭탄 돌리기를 지양하고, `@/shared/lib/http`의 `httpClient`를 사용하여 항상 `const { data, error } = await httpClient.get(...)` 형태로 처리합니다.
  - 조기 리턴(Guard Clause)을 통해 `if (error)` 분기를 상단에서 처리하여 코드의 깊은 들여쓰기를 방지합니다.
- **서버 에러 핸들링**:
  - Route Handler 작성 시 `withErrorHandler` 고차 함수를 감싸서 예외를 중앙 집중식 표준 JSON 응답으로 변환합니다.

---

## 4. 고차 함수(Higher-Order Function)와 함수 합성

- 반복되는 횡단 관심사(로깅, 에러 핸들링, 인증 검증 등)는 클래스 데코레이터나 미들웨어 상속 대신, **함수를 인자로 받아 새 함수를 반환하는 고차 함수**로 해결합니다.
  - 예: `withErrorHandler(async (req) => { ... })`
