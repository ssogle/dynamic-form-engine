"use client";

import * as React from "react";
import { Columns2, LayoutGrid, Orbit } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useBuilderFormList } from "../hooks/use-builder-form-list.hook";
import { BuilderFormList } from "./builder-form-list";
import { BuilderRelationGraph } from "./builder-relation-graph";

type BuilderWorkspaceViewMode = "split" | "list" | "graph";

/**
 * 빌더 폼 목록 및 3D 관계 그래프 통합 작업공간 (BuilderFormsWorkspace)
 *
 * `스플릿(3D 그래프 + 폼 목록)`, `목록만`, `3D 그래프만` 보기 전환을 지원하며
 * 이미 조회된 폼 목록 스키마를 재사용해 추가 네트워크 요청 없이 3D 관계 구조를 시각화합니다.
 */
export function BuilderFormsWorkspace() {
  const { forms, isLoading } = useBuilderFormList();
  const [viewMode, setViewMode] = React.useState<BuilderWorkspaceViewMode>("split");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <Button
          type="button"
          size="xs"
          variant={viewMode === "split" ? "default" : "outline"}
          className="gap-1.5 text-xs"
          onClick={() => setViewMode("split")}
        >
          <Columns2 className="size-3.5" />
          분할 보기
        </Button>
        <Button
          type="button"
          size="xs"
          variant={viewMode === "list" ? "default" : "outline"}
          className="gap-1.5 text-xs"
          onClick={() => setViewMode("list")}
        >
          <LayoutGrid className="size-3.5" />
          목록만
        </Button>
        <Button
          type="button"
          size="xs"
          variant={viewMode === "graph" ? "default" : "outline"}
          className="gap-1.5 text-xs"
          onClick={() => setViewMode("graph")}
        >
          <Orbit className="size-3.5" />
          3D 그래프만
        </Button>
      </div>

      {viewMode !== "list" && (
        <BuilderRelationGraph
          forms={forms}
          isLoading={isLoading}
          heightClassName={viewMode === "graph" ? "h-[540px]" : "h-[360px]"}
        />
      )}

      {viewMode !== "graph" && <BuilderFormList />}
    </div>
  );
}
