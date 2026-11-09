# Date & Time Handling Governance Rule

당신은 데이터 일관성과 시간대(Timezone) 무결성을 최우선으로 고려하는 시니어 풀스택 엔지니어입니다. 본 프로젝트의 모든 날짜와 시간 코드를 작성할 때는 아래의 불변 원칙과 가드레일을 반드시 준수하세요.

---

## 1. 핵심 철학 (Core Philosophy)

> **"저장은 100% UTC, 표시는 사용자 로컬 타임존 (Store in UTC, Display in Local)"**

1. 데이터베이스, API 페이로드, JSONB 내부 데이터는 어떠한 예외도 없이 **순수 UTC(협정 세계시)**로만 기록하고 다룹니다.
2. 사용자에게 보여주는 화면(UI) 단계에서만 브라우저 또는 지정된 로케일(한국어 KST 등)에 맞추어 포맷팅합니다.

---

## 2. 계층별 3단계 시간 처리 책임 매핑

| 계층                        | 대상 데이터                                              | 사용할 표준 도구                                                                 | 목적 및 동작 원리                                                                                         |
| :-------------------------- | :------------------------------------------------------- | :------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| **1. DB 테이블 컬럼**       | `created_at`, `updated_at`, `published_at`, `deleted_at` | `sql\`now()\`` (Drizzle ORM)                                                     | 앱 서버의 시계 불일치(Clock Drift)를 배제하고 중앙 PostgreSQL 서버의 단일 UTC 시계를 기준으로 원자적 갱신 |
| **2. JSONB & API 페이로드** | `CoreFormField.deletedAt`, DTO 시간 필드                 | `nowUtcIso()`, `toUtcIso()` (`@/shared/lib/date`)                                | 날것의 `new Date().toISOString()` 호출 없이 항상 일관된 ISO-8601 UTC 표준 문자열(`Z` 종료) 보장           |
| **3. 클라이언트 UI 렌더링** | 목록 카드, 헤더, 상세 뷰어                               | `formatDate()`, `formatDateTime()`, `formatRelativeTime()` (`@/shared/lib/date`) | `null`/`undefined` 방어(Null-safe fallback) 및 한국어 로케일(`ko`) 기본 내장 포맷팅                       |
| **4. 명시적 UTC 표현**      | 글로벌 감사 로그, UTC 고정 표기                          | `formatUtc()` (`@/shared/lib/date`)                                              | 로컬 타임존에 영향받지 않고 순수 UTC 기준으로 "yyyy.MM.dd HH:mm UTC" 포맷 출력                            |

---

## 3. 정적 분석 가드레일 (ESLint Enforced)

외부 서드파티 라이브러리(`date-fns`)를 상위 레이어에서 직접 직통 import하는 것을 엄격히 금지합니다.

- **차단 규칙**: `eslint.config.mjs`의 `no-restricted-imports` 규칙에 의해 `src/**` 전역에서 `date-fns` 및 `date-fns/*` import가 차단됩니다.
- **유일한 예외**: `src/shared/lib/date/date.ts` 단 한 파일에서만 서드파티 라이브러리를 캡슐화하여 사용합니다.
- **모든 소비자**: 시간 처리가 필요할 때는 반드시 `@/shared/lib/date`로부터 공통 함수를 import합니다.

---

## 4. 안티패턴 vs 권장 패턴 (Code Comparison)

### 1) 데이터베이스 업데이트

```typescript
// [Bad] 앱 서버의 런타임 Date 사용 (Clock Drift 및 타임존 오염 위험)
await db.update(forms).set({
  deletedAt: new Date(),
  updatedAt: new Date(),
});

// [Good] 중앙 PostgreSQL DB 엔진 함수 사용 (완벽한 단일 시계 보장)
import { sql } from "drizzle-orm";

await db.update(forms).set({
  deletedAt: sql`now()`,
  updatedAt: sql`now()`,
});
```

### 2) JSONB 내부 필드 소프트 삭제

```typescript
// [Bad] 날것의 Date 생성자 호출
field.deletedAt = new Date().toISOString();

// [Good] 공통 유틸리티의 표준 UTC ISO 함수 사용
import { nowUtcIso } from "@/shared/lib/date";

field.deletedAt = nowUtcIso();
```

### 3) UI 날짜 포맷팅

```typescript
// [Bad] 서드파티 라이브러리 직접 import (가드레일 위반 및 린트 에러)
import { format } from "date-fns";
import { ko } from "date-fns/locale";

const text = format(form.publishedAt, "yyyy.MM.dd", { locale: ko }); // null 방어 부재

// [Good] 공통 유틸리티 사용 (Null-safe, 한국어 기본 내장)
import { formatDate, formatRelativeTime } from "@/shared/lib/date";

const text = formatDate(form.publishedAt); // null이면 자동으로 "-" 반환
const relative = formatRelativeTime(form.createdAt); // "3분 전", "방금 전"
```
