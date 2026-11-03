import { Button } from "@/shared/ui/button";

export default function Home() {
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
