import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/ui/card";

/**
 * 애플리케이션 전역 404 Not Found 페이지 (`src/app/not-found.tsx`)
 *
 * 존재하지 않는 경로 또는 삭제된 리소스 URL 접근 시
 * 메인 게이트웨이(/)로 복귀할 수 있는 동선을 제공합니다.
 */
export default function NotFoundPage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-3">
          <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg">
            <FileQuestion className="size-5" />
          </div>
          <CardTitle className="text-lg font-semibold">
            요청하신 페이지를 찾을 수 없습니다
          </CardTitle>
          <CardDescription className="text-sm/relaxed">
            주소가 잘못되었거나 이동·삭제된 페이지입니다. 메인 게이트웨이 또는 워크스페이스에서
            원하는 작업을 이어가세요.
          </CardDescription>
        </CardHeader>

        <CardFooter className="flex items-center justify-end gap-2">
          <Button type="button" asChild>
            <Link href="/">
              <Home className="size-4" />
              홈으로 이동
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
