import * as React from "react";
import Link from "next/link";
import { FormList } from "@/features/list-forms";
import { Button } from "@/shared/ui/button";

/**
 * 컨슈머 메인 화면 (/consumer)
 *
 * 일반 사용자(응답자 및 뷰어)를 위한 엔드유저 포털 환경입니다.
 * 공개된 폼에 응답을 제출하거나 공유된 데이터 뷰를 열람할 수 있습니다.
 */
export default function ConsumerPage() {
  return (
    <div className="bg-muted/10 min-h-screen font-sans">
      <header className="border-border/60 bg-background/80 border-b px-6 py-4 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between">
          <span className="font-heading text-foreground text-lg font-bold tracking-tight">
            컨슈머 포털
          </span>
          <Button asChild variant="outline" size="sm">
            <Link href="/builder/forms">빌더로 이동</Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="space-y-8">
          <div className="space-y-2">
            <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
              참여 가능한 폼 목록
            </h1>
            <p className="text-muted-foreground text-sm/relaxed">
              작성 및 제출이 가능한 공개 설문지와 접수창 목록입니다. 원하는 폼을 선택하여 응답을
              제출하세요.
            </p>
          </div>

          <div className="max-w-2xl">
            <FormList />
          </div>
        </div>
      </main>
    </div>
  );
}
