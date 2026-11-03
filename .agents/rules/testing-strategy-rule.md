# Testing Strategy & Harness Governance Rule

당신은 높은 신뢰성의 엔지니어링 하네스를 구축하는 테스트 아키텍트입니다. 본 프로젝트(동적 폼 빌더 & AI 런타임 엔진)의 안정성과 빠른 개발 리듬을 유지하기 위해 아래의 테스트 원칙, 범위, 작성 가이드라인을 반드시 준수하세요.

---

## 1. 테스트 철학: ROI(투자 대비 효과) 중심의 테스트

우리는 100%의 무의미한 커버리지 대신, **"결함 발생 시 비즈니스 타격이 큰 핵심 도메인과 복잡한 상태 전이"**에 테스트 자원을 집중합니다.

- **구현 세부사항(Implementation Details)이 아닌 사용자 관점(Behavior)을 테스트**합니다.
  - ❌ 컴포넌트 내부의 특정 `useState` 변수명이나 비공개 함수 호출 여부 검증
  - ⭕ 사용자가 입력값을 변경했을 때 화면에 에러 문구가 뜨는지, 올바른 페이로드가 제출되는지 검증
- **테스트 코드는 리팩터링의 안전망**이어야 하며, 내부 구현을 바꿨다고 해서 테스트가 깨져서는 안 됩니다.

---

## 2. 테스트 대상: 반드시 테스트해야 하는 것 (What to Test) ✅

### ① 핵심 도메인 모델 및 스키마 엔진 (`entities/`, `features/*/model/`)

- **JSON Schema ➔ Zod 스키마 런타임 변환 엔진**:
  - 필드 타입 매핑 (text, number, select, date 등)
  - 유효성 검증 규칙 (required, min, max, regex 패턴)
- **AI Structured Outputs 파서 & 정제 로직**:
  - Gemini가 반환한 비정형 JSON을 안전하게 정제(Sanitization)하는 로직
  - 필수 키 누락, 타입 불일치 등 예외 상황에 대한 방어 로직 (Fallbacks)
- **동적 폼 상태 전이 및 조건부 렌더링 규칙**:
  - 특정 필드 값에 따라 다음 필드가 활성화/비활성화되는 종속성 로직

### ② 복합 사용자 인터랙션 (`features/*/ui/`)

- **동적 폼 인터랙션**:
  - 사용자 입력에 따른 유효성 검증 메시지 노출 여부
  - 폼 제출 시 유효한 데이터가 올바른 포맷으로 전달되는지
- **AI 결과 검수(Audit Trail) 인터랙션**:
  - 신뢰도 점수 기반 위험 필드 하이라이팅 표시

### ③ 공통 유틸리티 및 변환기 (`shared/lib/`)

- 순수 함수(Pure Functions), 데이터 변환 유틸, 수학적 계산, 문자열 포매터 등

---

## 3. 테스트 제외 대상: 작성하지 않는 것 (What NOT to Test) 🚫

테스트 비용 대비 가치가 낮고 유지보수 비용만 가중시키는 테스트는 작성하지 않습니다:

- ❌ **단순 UI 스타일링**:
  - 특정 Tailwind CSS 클래스(`px-4`, `text-sm`)가 적용되었는지 검사하지 않습니다.
- ❌ **정적 텍스트 및 프레젠테이션 컴포넌트**:
  - 로직 없이 단순히 전달받은 props를 그리기만 하는 얇은 레이아웃 컴포넌트.
- ❌ **외부 라이브러리 자체의 기능**:
  - `shadcn/ui` (Radix UI) 프리미티브 컴포넌트 자체의 키보드 네비게이션 동작.
  - `zod` 파서 자체의 내장 메서드(`z.string().parse(...)`) 정상 동작 여부.
  - `react-hook-form` 라이브러리 내부 상태 관리 메커니즘.
- ❌ **Next.js 프레임워크 자체의 기능**:
  - 라우팅 페이지 이동 동작, 폰트/이미지 최적화 런타임.
- ❌ **타입스크립트가 이미 보장하는 영역**:
  - 인자의 타입 검사나 `null`/`undefined` 방어 등 이미 `strict: true` 컴파일러가 잡아내는 영역.

---

## 4. 테스트 파일 배치 및 명명 규칙 (Co-location)

FSD 아키텍처 원칙에 따라 테스트 파일은 **검증 대상 모듈과 동일한 디렉터리에 나란히 위치(Co-location)**시킵니다.

```
src/
├── entities/form/
│   ├── model/
│   │   ├── schema-builder.ts
│   │   └── schema-builder.test.ts  # 대상 코드 바로 옆에 배치
│   └── index.ts
├── features/form-builder/
│   ├── ui/
│   │   ├── dynamic-form.tsx
│   │   └── dynamic-form.test.tsx   # 컴포넌트 테스트
│   └── index.ts
└── shared/
    └── lib/
        ├── utils.ts
        └── utils.test.ts
```

- 파일명 컨벤션: 반드시 `kebab-case`를 유지하며 `*.test.ts` 또는 `*.test.tsx`를 사용합니다.

---

## 5. 테스트 스위트 작성 표준 (Vitest + Testing Library)

### ① 모킹(Mocking) 원칙

- 외부 I/O(Supabase API, Gemini AI SDK)는 반드시 경계(Boundary)에서 모킹합니다.
- 복잡한 모킹보다는 실제 동작에 가까운 가짜 데이터(Fixture)를 구성하여 테스트합니다.

### ② 컴포넌트 테스트 쿼리 우선순위 (RTL 표준)

사용자가 화면을 인식하는 방식과 가장 유사한 쿼리를 우선 사용합니다:

1. `getByRole` (접근성 역할 + 접근 가능한 이름: e.g., `{ name: "제출하기" }`)
2. `getByLabelText` (폼 라벨)
3. `getByPlaceholderText`
4. `getByText`
5. ❌ `getByTestId`, CSS 셀렉터(클래스명)는 최후의 수단으로만 사용합니다.

---

## 6. 개발 루프 및 실행 가이드

- **기능 개발 시 (TDD)**:
  - `npm run test:watch`를 백그라운드에 켜두고 실시간 피드백을 받으며 개발합니다.
  - 실패하는 최소 테스트 작성(Red) ➔ 구현(Green) ➔ 구조 개선(Refactor)
- **커밋 및 푸시 전**:
  - `npm test`: 전체 테스트 스위트 확인
  - `npm run test:coverage`: 핵심 도메인 로직(`entities`, `features/model`)의 커버리지 누락 확인
