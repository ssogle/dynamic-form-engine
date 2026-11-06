import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";

/**
 * 빌더 내부 뷰 목록 화면 (/builder/views)
 *
 * 폼으로 수집된 데이터를 가공하여 생성된 테이블, 통계 차트, 대시보드 뷰 목록을 관리합니다.
 */
export default function BuilderViewsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">등록된 뷰 목록</h1>
        <p className="text-muted-foreground text-sm/relaxed">
          폼을 통해 수집된 응답 데이터를 기반으로 생성된 표, 통계 차트 및 대시보드 뷰 목록입니다.
        </p>
      </div>

      <Card className="border-border/80 bg-muted/20 border-dashed py-12 text-center shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-base font-semibold">
            아직 생성된 뷰가 없습니다
          </CardTitle>
          <CardDescription className="text-muted-foreground mx-auto max-w-md text-xs/relaxed">
            폼으로 유입된 데이터가 축적되면, AI Navigator에게 차트 요약이나 피벗 테이블 뷰 생성을
            요청할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm">
            <Link href="/builder/forms">폼 목록으로 이동하기</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
