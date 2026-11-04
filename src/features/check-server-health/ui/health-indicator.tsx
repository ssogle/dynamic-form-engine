"use client";

import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { useHealthQuery } from "../queries/use-health.query";

/**
 * 서버 헬스체크 상태 인디케이터 컴포넌트
 *
 * BFF /api/v1/health 엔드포인트의 통신 상태를 실시간으로 조회하여
 * 정상(200), 로딩, 에러 상태를 시각적인 배지와 타임스탬프로 렌더링합니다.
 */
export function HealthIndicator() {
  const { data, isLoading, isError, error } = useHealthQuery();

  if (isLoading) {
    return (
      <Card className="flex items-center justify-between p-4">
        <span className="text-muted-foreground text-sm">서버 상태 확인 중...</span>
        <Badge variant="outline">확인 중</Badge>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="border-destructive/50 bg-destructive/5 flex items-center justify-between p-4">
        <div className="flex flex-col gap-1">
          <span className="text-destructive text-sm font-medium">서버 연결 실패</span>
          {error && (
            <span className="text-muted-foreground text-xs">
              [{error.code}] {error.message}
            </span>
          )}
        </div>
        <Badge variant="destructive">오류</Badge>
      </Card>
    );
  }

  return (
    <Card className="flex items-center justify-between p-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-foreground text-sm font-semibold">서버 정상 작동 중</span>
          <Badge variant="default" className="bg-emerald-600 text-white hover:bg-emerald-600">
            {data.status.toUpperCase()}
          </Badge>
        </div>
        <span className="text-muted-foreground text-xs">확인 시각: {data.timestamp}</span>
      </div>
    </Card>
  );
}
