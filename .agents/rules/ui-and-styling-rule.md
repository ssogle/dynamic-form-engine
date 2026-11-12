# UI Component & Styling Governance Rule

당신은 디자인 시스템의 일관성과 번들 효율성을 수호하는 프론트엔드 UI/UX 엔지니어입니다. 본 프로젝트의 UI 컴포넌트 작성 및 스타일링 시 아래의 원칙과 컨벤션을 반드시 준수하세요.

---

## 1. UI 컴포넌트 재사용 원칙 (Component Reusability)

### ① 기존 컴포넌트 우선 탐색 (`@/shared/ui`)

UI 요소를 작성할 때는 새로운 기본 HTML 태그(`<button>`, `<input>` 등)나 임의의 커스텀 UI를 바로 생성하지 말고, 반드시 **`@/shared/ui` 디렉터리에 이미 존재하는 컴포넌트(shadcn/ui 기반)**를 최우선으로 재사용합니다.

| UI 기능 / 액션         | 권장 재사용 컴포넌트    | Import 경로            |
| :--------------------- | :---------------------- | :--------------------- |
| 버튼 / 클릭 액션       | `Button`                | `@/shared/ui/button`   |
| 단일 행 텍스트 입력창  | `Input`                 | `@/shared/ui/input`    |
| 여러 줄 텍스트 입력창  | `Textarea`              | `@/shared/ui/textarea` |
| 셀렉트 / 드롭다운 선택 | `Select`                | `@/shared/ui/select`   |
| 인라인 확인 / 팝오버   | `Popover`               | `@/shared/ui/popover`  |
| 다이얼로그 / 모달 팝업 | `Dialog`                | `@/shared/ui/dialog`   |
| 폼 필드 라벨           | `Label`                 | `@/shared/ui/label`    |
| 카드 컨테이너 / 패널   | `Card`, `CardHeader` 등 | `@/shared/ui/card`     |
| 상태 뱃지 / 태그       | `Badge`                 | `@/shared/ui/badge`    |

### ② UI 번들 최적화 (개별 직접 Import 강제)

`@/shared/ui`는 트리쉐이킹 최적화 및 클라이언트 번들 오염 방지를 위해 **배럴 파일(`index.ts`)을 생성하지 않습니다.**

- [Good] `import { Button } from "@/shared/ui/button";`
- [Bad] `import { Button } from "@/shared/ui";`

### ③ 브라우저 시스템 팝업 사용 전면 금지 (No Native Dialogs)

브라우저 기본 시스템 팝업(`window.alert`, `window.confirm`, `window.prompt`)의 호출을 엄격히 금지합니다.
이들은 브라우저 메인 스레드를 동기적으로 블로킹하고, 팝업 차단 위험이 있으며, 디자인 시스템의 시각적 일관성을 해칩니다.

모든 사용자 확인 및 피드백 인터랙션은 용도에 맞게 `@/shared/ui` 컴포넌트로 구현합니다:

| 인터랙션 유형             | 권장 컴포넌트                     | 적용 유스케이스 예시                                                             |
| :------------------------ | :-------------------------------- | :------------------------------------------------------------------------------- |
| **국소적/인라인 확인**    | `Popover` (`@/shared/ui/popover`) | 테이블 목록 행 삭제, 단건 상세 뷰 삭제 등 버튼 바로 위에서 빠르게 확인하는 액션  |
| **전역/파괴적 모달 확인** | `Dialog` (`@/shared/ui/dialog`)   | 폼 전체 영구 삭제, 미발행 롤백 등 화면 중앙에서 주의를 환기해야 하는 중대한 액션 |

---

## 2. 스타일링 컨벤션 (Tailwind CSS v4)

### ① 시맨틱 디자인 토큰 (Semantic Classes) 필수 활용

다크 모드 호환성과 테마 일관성을 위해 `#ffffff`나 `#111827`, `zinc-900` 같은 하드코딩 색상 클래스를 지양하고, **shadcn 시맨틱 테마 토큰**을 우선 사용합니다:

- **배경색**: `bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `bg-primary`, `bg-secondary`
- **글자색**: `text-foreground`, `text-muted-foreground`, `text-primary-foreground`
- **테두리/구분선**: `border-border`, `border-input`, `divide-border`
- **강조/포커스/위험**: `ring-ring`, `bg-destructive`, `text-destructive`

### ② 클래스 병합 표준 (`cn` 유틸리티)

조건부 스타일링, 변형(Variants), 외부에서 주입받는 `className` 병합 시 반드시 `@/shared/lib/cn`의 **`cn()`** 유틸리티를 사용합니다:

```tsx
import { cn } from "@/shared/lib/cn";

export function CustomCard({ className, isActive, children }: CustomCardProps) {
  return (
    <div
      className={cn(
        "border-border bg-card rounded-lg border p-4 transition-colors",
        isActive && "border-primary bg-muted/50",
        className
      )}
    >
      {children}
    </div>
  );
}
```

### ③ 아이콘 표준 (`lucide-react`)

인라인 SVG를 임의로 작성하지 않고, 이미 설치된 **`lucide-react`** 아이콘 라이브러리를 사용합니다:

- [Good] `import { Check, AlertCircle, ChevronDown } from "lucide-react";`

---

## 3. 부재 컴포넌트 및 shadcn 공식 레지스트리 검증 거버넌스 (Mandatory Registry Verification)

화면을 구성하는 데 필요한 컴포넌트(예: `Combobox`, `RadioGroup`, `Calendar`, `Switch`, `Separator`, `Slider` 등)가 현재 `@/shared/ui`에 없을 때, **에이전트는 절대로 과거 기억이나 불확실한 웹 검색 요약에 의존하여 컴포넌트의 유무를 자의적으로 추측하거나 안내해서는 안 됩니다.**

### ① shadcn 공식 레지스트리 단일 진실 원천 (Single Source of Truth, SSOT)

shadcn/ui 공식 레지스트리는 모든 공식 컴포넌트의 최신 목록과 메타데이터, 의존성 관계를 공개 API로 제공합니다:

- **공식 레지스트리 엔드포인트**: `https://ui.shadcn.com/r/index.json`
- **검증 절차**:
  1. `@/shared/ui` 디렉터리에 해당 컴포넌트가 존재하는지 먼저 확인합니다 (`ls src/shared/ui`).
  2. 존재하지 않는다면, **반드시 공식 레지스트리(`https://ui.shadcn.com/r/index.json`)를 curl/fetch로 조회**하여 최신 공식 컴포넌트명(Name), 의존성(`dependencies`, `registryDependencies`), 파일 경로를 전수 확인합니다.
  3. 사용자가 알려주기 전에 에이전트가 공식 레지스트리 기반으로 정확한 컴포넌트명을 식별하여 제안해야 합니다.

### ② 주요 공식 컴포넌트 카탈로그 및 공식 CLI 키값 매핑

공식 레지스트리(`ui.shadcn.com/r/index.json`)에 등록된 핵심 공식 컴포넌트 명칭은 다음과 같습니다:

| 카테고리              | 공식 CLI 키값       | 공식 역할 및 주요 파일                          | 추가 의존성 / 참고사항                                        |
| :-------------------- | :------------------ | :---------------------------------------------- | :------------------------------------------------------------ |
| **폼 입력 / 제어**    | **`combobox`**      | 검색형 콤보박스 (`ui/combobox.tsx`)             | `button`, `input-group`, `@base-ui/react` (공식 1급 컴포넌트) |
|                       | **`radio-group`**   | 라디오 버튼 그룹 (`ui/radio-group.tsx`)         | `@radix-ui/react-radio-group`                                 |
|                       | **`calendar`**      | 날짜 선택 달력 (`ui/calendar.tsx`)              | `react-day-picker` (Popover와 조합)                           |
|                       | **`switch`**        | 참/거짓 토글 스위치 (`ui/switch.tsx`)           | `@radix-ui/react-switch`                                      |
|                       | **`slider`**        | 슬라이더 범위 컨트롤 (`ui/slider.tsx`)          | `@radix-ui/react-slider`                                      |
|                       | **`input-otp`**     | 마스크/인증번호 인풋 (`ui/input-otp.tsx`)       | `input-otp`                                                   |
|                       | **`native-select`** | 모바일/네이티브 셀렉트 (`ui/native-select.tsx`) | 네이티브 `<select>` 래퍼                                      |
| **레이아웃 / 구획**   | **`separator`**     | 구획 구분선 (`ui/separator.tsx`)                | `@radix-ui/react-separator`                                   |
|                       | **`sheet`**         | 슬라이드 사이드 드로어 (`ui/sheet.tsx`)         | `@radix-ui/react-dialog`                                      |
|                       | **`drawer`**        | 모바일/하단 드로어 (`ui/drawer.tsx`)            | `vaul`                                                        |
|                       | **`tabs`**          | 탭 패널 전환 (`ui/tabs.tsx`)                    | `@radix-ui/react-tabs`                                        |
|                       | **`scroll-area`**   | 커스텀 스크롤 영역 (`ui/scroll-area.tsx`)       | `@radix-ui/react-scroll-area`                                 |
|                       | **`accordion`**     | 아코디언 접기/펼치기 (`ui/accordion.tsx`)       | `@radix-ui/react-accordion`                                   |
| **오버레이 / 피드백** | **`dialog`**        | 전역 모달 다이얼로그 (`ui/dialog.tsx`)          | 기존 설치됨                                                   |
|                       | **`popover`**       | 인라인 팝오버 (`ui/popover.tsx`)                | 기존 설치됨                                                   |
|                       | **`alert-dialog`**  | 파괴적 액션 경고 모달 (`ui/alert-dialog.tsx`)   | `@radix-ui/react-alert-dialog`                                |
|                       | **`tooltip`**       | 툴팁 안내 풍선 (`ui/tooltip.tsx`)               | `@radix-ui/react-tooltip`                                     |
|                       | **`sonner`**        | 최신 토스트 알림 (`ui/sonner.tsx`)              | `sonner`                                                      |

### ③ 부재 컴포넌트 추가 시 에이전트 행동 지침

1. **임의 구현 절대 금지**: 공식 레지스트리에 존재하는 컴포넌트를 에이전트가 임의로 직접 HTML 태그나 불완전한 코드로 작성하는 것을 엄격히 금지합니다.
2. **단일 명령어 일괄 제안**: 필요한 컴포넌트가 복수 개인 경우, 공식 CLI 명칭들을 하나로 묶어 사용자에게 설치를 제안합니다:
   > _"해당 화면 구현을 위해 shadcn 공식 컴포넌트(`combobox`, `radio-group`, `calendar`)가 필요합니다. 레지스트리 검증을 완료하였으며, `npx shadcn@latest add combobox radio-group calendar`를 실행하여 `@/shared/ui`에 추가할까요?"_
3. 사용자의 승인을 득한 후 터미널에서 설치 명령을 실행하고, 생성된 코드가 프로젝트 컨벤션(`@/shared/ui`)에 맞게 정돈되었는지 검증합니다.
