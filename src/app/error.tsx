"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/ui/card";

interface GlobalErrorPageProps {
  /** 발생한 런타임 예외 객체 (Next.js App Router가 주입) */
  error: Error & { digest?: string };
  /** 현재 세그먼트를 다시 렌더링하여 복구를 시도하는 Next.js 리셋 콜백 */
  reset: () => void;
}

/**
 * 애플리케이션 전역 런타임 에러 바운더리 UI (`src/app/error.tsx`)
 *
 * 예상치 못한 클라이언트/서버 렌더링 예외 발생 시 Next.js 기본 흑백 오류 화면 대신
 * 프로젝트 디자인 시스템에 맞춘 복구 안내 카드(다시 시도 / 홈으로 이동)를 제공합니다.
 */
export default function GlobalErrorPage({ error, reset }: GlobalErrorPageProps) {
  useEffect(() => {
    console.error("[Application Error Boundary]", error);
  }, [error]);

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-3">
          <div className="bg-destructive/10 text-destructive flex size-10 items-center justify-center rounded-lg">
            <AlertTriangle className="size-5" />
          </div>
          <CardTitle className="text-lg font-semibold">
            화면을 불러오는 중 오류가 발생했습니다
          </CardTitle>
          <CardDescription className="text-sm/relaxed">
            일시적인 네트워크 문제이거나 예기치 못한 요청 오류일 수 있습니다. 다시 시도하거나 메인
            게이트웨이로 이동해 주세요.
          </CardDescription>
        </CardHeader>

        <CardFooter className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/">
              <Home className="size-4" />
              홈으로 이동
            </Link>
          </Button>
          <Button type="button" onClick={reset}>
            <RotateCcw className="size-4" />
            다시 시도
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
