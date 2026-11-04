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
| 다이얼로그 / 모달 팝업 | `Dialog`                | `@/shared/ui/dialog`   |
| 폼 필드 라벨           | `Label`                 | `@/shared/ui/label`    |
| 카드 컨테이너 / 패널   | `Card`, `CardHeader` 등 | `@/shared/ui/card`     |
| 상태 뱃지 / 태그       | `Badge`                 | `@/shared/ui/badge`    |

### ② UI 번들 최적화 (개별 직접 Import 강제)

`@/shared/ui`는 트리쉐이킹 최적화 및 클라이언트 번들 오염 방지를 위해 **배럴 파일(`index.ts`)을 생성하지 않습니다.**

- [Good] `import { Button } from "@/shared/ui/button";`
- [Bad] `import { Button } from "@/shared/ui";`

---

## 2. 스타일링 컨벤션 (Tailwind CSS v4)

### ① 시맨틱 디자인 토큰 (Semantic Classes) 필수 활용

다크 모드 호환성과 테마 일관성을 위해 `#ffffff`나 `#111827`, `zinc-900` 같은 하드코딩 색상 클래스를 지양하고, **shadcn 시맨틱 테마 토큰**을 우선 사용합니다:

- **배경색**: `bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `bg-primary`, `bg-secondary`
- **글자색**: `text-foreground`, `text-muted-foreground`, `text-primary-foreground`
- **테두리/구분선**: `border-border`, `border-input`, `divide-border`
- **강조/포커스/위험**: `ring-ring`, `bg-destructive`, `text-destructive`

### ② 클래스 병합 표준 (`cn` 유틸리티)

조건부 스타일링, 변형(Variants), 외부에서 주입받는 `className` 병합 시 반드시 `@/shared/lib/utils`의 **`cn()`** 유틸리티를 사용합니다:

```tsx
import { cn } from "@/shared/lib/utils";

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

## 3. 부재 컴포넌트에 대한 에이전트 행동 지침 (Missing Components)

화면을 구성하는 데 필요한 컴포넌트(예: `Slider`, `Popover`, `Switch`, `Tabs`, `Table` 등)가 현재 `@/shared/ui`에 없다면:

1. **임의로 복잡한 커스텀 UI를 새로 만들지 않습니다.** (접근성, 키보드 네비게이션, 스타일 파편화 방지)
2. **사용자에게 표준 shadcn 컴포넌트 추가를 먼저 제안**합니다:
   > _"해당 기능 구현을 위해 shadcn의 `[컴포넌트명]`이 필요합니다. `npx shadcn@latest add [컴포넌트명]`을 실행하여 `@/shared/ui`에 추가할까요?"_
3. 사용자의 승인 후 표준 방식으로 컴포넌트를 추가하여 일관성을 유지합니다.
