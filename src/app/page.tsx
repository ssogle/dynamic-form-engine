"use client";

import { HealthIndicator } from "@/features/check-server-health";
import { FormList } from "@/features/list-forms";
import { useCounterStore } from "@/shared/store/counter.store";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

export default function Home() {
  const { count, increment, decrement, reset } = useCounterStore();

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 p-6 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 text-center sm:items-start sm:text-left">
        <div className="flex flex-col gap-3">
          <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            AI Dynamic Form Builder & Runtime Engine
          </span>
          <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
            AI 동적 폼 빌더에 오신 것을 환영합니다
          </h1>
          <p className="text-muted-foreground text-lg">
            자연어로 폼을 정의하고 비정형 문서를 파싱하여 자동 입력하세요.
          </p>
        </div>

        {/* TanStack Query + BFF 통신 헬스체크 연동 카드 */}
        <div className="w-full max-w-sm">
          <HealthIndicator />
        </div>

        {/* Drizzle ORM + PostgreSQL DB 폼 목록 실시간 연동 카드 */}
        <div className="w-full max-w-md">
          <FormList />
        </div>

        {/* Zustand 전역 상태 연동 테스트 카드 */}
        <Card className="w-full max-w-sm p-4">
          <div className="flex flex-col gap-3">
            <span className="text-muted-foreground text-xs font-medium">
              Zustand 전역 상태 연동 테스트
            </span>
            <div className="flex items-center gap-4">
              <span className="text-foreground text-2xl font-bold">{count}</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={decrement}>
                  - 1
                </Button>
                <Button size="sm" variant="outline" onClick={increment}>
                  + 1
                </Button>
                <Button size="sm" variant="ghost" onClick={reset}>
                  초기화
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button size="default">시작하기</Button>
          <Button variant="outline" size="default">
            문서 보기
          </Button>
        </div>
      </main>
    </div>
  );
}
