import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

/**
 * 서비스 메인 게이트웨이 페이지 (/)
 *
 * 사용자의 목적에 따라 [빌더] 환경과 [컨슈머] 환경으로 진입할 수 있는 메인 관문입니다.
 */
export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50/50 p-6 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col items-center gap-10 text-center">
        {/* 서비스 헤더 */}
        <div className="space-y-3">
          <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Autonomous Form Engine
          </span>
          <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
            AI Dynamic Form Engine
          </h1>
          <p className="text-muted-foreground max-w-xl text-base/relaxed sm:text-lg">
            마우스 수동 편집 없이 자연어로 폼과 뷰를 자율 생성하는 제작 환경과 편리한 응답 제출
            경험을 제공합니다.
          </p>
        </div>

        {/* 2열 선택 카드 게이트웨이 */}
        <div className="grid w-full grid-cols-1 gap-6 text-left sm:grid-cols-2">
          {/* 1. 빌더 카드 */}
          <Card className="border-border/80 bg-card flex flex-col justify-between p-2 shadow-xs transition-shadow hover:shadow-md">
            <CardHeader className="space-y-2">
              <span className="text-primary text-xs font-semibold tracking-wider uppercase">
                Creator Environment
              </span>
              <CardTitle className="text-foreground text-xl font-bold">빌더 (Builder)</CardTitle>
              <CardDescription className="text-muted-foreground text-sm/relaxed">
                좌측에 상주하는 AI Navigator와 대화하며 실시간으로 폼 스키마를 설계·수정하고, 수집된
                데이터 기반의 뷰 목록을 관리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <Button asChild size="default" className="w-full font-medium">
                <Link href="/builder/forms">빌더 시작하기</Link>
              </Button>
            </CardContent>
          </Card>

          {/* 2. 컨슈머 카드 */}
          <Card className="border-border/80 bg-card flex flex-col justify-between p-2 shadow-xs transition-shadow hover:shadow-md">
            <CardHeader className="space-y-2">
              <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                End-User Portal
              </span>
              <CardTitle className="text-foreground text-xl font-bold">컨슈머 (Consumer)</CardTitle>
              <CardDescription className="text-muted-foreground text-sm/relaxed">
                공개 배포된 설문지나 신청서에 응답을 직접 입력하여 제출하고, 공유된 결과 뷰와 통계
                데이터를 열람합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <Button asChild variant="outline" size="default" className="w-full font-medium">
                <Link href="/consumer">컨슈머 입장하기</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
