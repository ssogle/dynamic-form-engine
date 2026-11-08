import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";

/**
 * 컨슈머 내부 뷰 목록 화면 (/consumer/views)
 *
 * 폼으로 수집된 데이터를 바탕으로 생성 및 공유된 표, 통계 차트, 대시보드 뷰 목록을 열람합니다.
 */
export default function ConsumerViewsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">공유된 뷰 목록</h1>
        <p className="text-muted-foreground text-sm/relaxed">
          수집된 폼 응답 데이터를 바탕으로 요약 및 집계된 통계 차트와 대시보드 뷰 목록입니다.
        </p>
      </div>

      <Card className="border-border/80 bg-muted/20 border-dashed py-12 text-center shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-base font-semibold">
            아직 공유된 뷰가 없습니다
          </CardTitle>
          <CardDescription className="text-muted-foreground mx-auto max-w-md text-xs/relaxed">
            관리자가 빌더에서 생성한 데이터 차트나 대시보드가 공개되면 이곳에서 확인할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm">
            <Link href="/consumer/forms">참여 가능한 폼 목록으로 이동</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
