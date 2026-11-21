import * as React from "react";
import { BuilderFormsWorkspace } from "@/features/manage-builder-forms";

/**
 * 빌더 내부 폼 목록 화면 (/builder/forms)
 *
 * 데이터베이스에 저장된 모든 폼 목록과 3D 관계 그래프를 함께 표시하며,
 * AI Navigator에게 명령하여 새로운 폼을 생성하거나 기존 폼의 라이브 캔버스로 진입합니다.
 */
export default function BuilderFormsPage() {
  return (
    <div className="w-full space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">등록된 폼 목록</h1>
        <p className="text-muted-foreground text-sm/relaxed">
          데이터베이스에 영속화된 모든 활성 폼 목록입니다. 새로운 폼을 설계하고 싶다면 AI
          Navigator에게 원하는 데이터 모델과 입력 항목, 관계 구조를 말씀해 보세요. 즉시 라이브
          캔버스가 생성됩니다.
        </p>
      </div>

      <div className="w-full">
        <BuilderFormsWorkspace />
      </div>
    </div>
  );
}
