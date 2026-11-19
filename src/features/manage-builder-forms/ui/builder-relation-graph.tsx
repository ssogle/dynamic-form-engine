"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Maximize2, Network } from "lucide-react";
import type { ForceGraphMethods, LinkObject, NodeObject } from "react-force-graph-3d";
import SpriteText from "three-spritetext";
import {
  buildFormRelationGraph,
  type Form,
  type FormRelationGraphLink,
  type FormRelationGraphNode,
} from "@/entities/form";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { ForceGraph3DCanvas } from "@/shared/ui/force-graph-3d-canvas";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/cn";

type Graph3DNode = FormRelationGraphNode & Record<string, unknown>;
type Graph3DLink = FormRelationGraphLink & Record<string, unknown>;

const MAX_NODE_LABEL_LENGTH = 18;

const getNodeVal = (node: NodeObject<Graph3DNode>) => Math.max(4, 4 + node.relationDegree * 2.5);
const getNodeLabel = (node: NodeObject<Graph3DNode>) =>
  `${node.title} (${node.isPublished ? "발행됨" : "작성 중"} · 필드 ${node.activeFieldCount}개 · 관계 ${node.relationDegree}건)`;
/**
 * 3D 구체 노드 위에 항상 카메라 정면을 향하는 폼 이름 스프라이트를 부착한다.
 * 모듈 스코프 정적 함수로 유지해 hover 상태 변경 시 스프라이트가 불필요하게 재생성되지 않도록 한다.
 */
const getNodeThreeObject = (node: NodeObject<Graph3DNode>) => {
  const displayTitle =
    node.title.length > MAX_NODE_LABEL_LENGTH
      ? `${node.title.slice(0, MAX_NODE_LABEL_LENGTH - 1)}...`
      : node.title;
  const sprite = new SpriteText(displayTitle, 4.5, node.isPublished ? "#a7f3d0" : "#bae6fd");
  sprite.backgroundColor = "rgba(15, 23, 42, 0.82)";
  sprite.borderColor = node.isPublished ? "rgba(52, 211, 153, 0.45)" : "rgba(56, 189, 248, 0.45)";
  sprite.borderWidth = 0.6;
  sprite.borderRadius = 4;
  sprite.padding = [4, 2];
  sprite.fontFace = "Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
  sprite.fontWeight = "600";
  // `SpriteText`는 런타임에서 `THREE.Sprite`를 상속하므로 `center.y`로 구체 바로 위에 라벨을 띄운다.
  (sprite as unknown as { center: { y: number } }).center.y = -0.85;
  return sprite;
};
const getLinkLabel = (link: LinkObject<Graph3DNode, Graph3DLink>) =>
  `${link.label} (${link.multiple ? "다중" : "단일"})`;
const getLinkCurvature = (link: LinkObject<Graph3DNode, Graph3DLink>) => link.curvature;
const getLinkColor = () => "rgba(148, 163, 184, 0.55)";
const getParticleColor = () => "#7dd3fc";

export interface BuilderRelationGraphProps {
  /** 빌더에 등록된 활성 폼 목록 */
  forms: Form[] | undefined;
  /** 목록 로딩 중 여부 */
  isLoading?: boolean | undefined;
  /** 캔버스 높이 클래스명 */
  heightClassName?: string | undefined;
}

/**
 * 빌더 폼 간 `relation` 연결 구조를 3D 궤도 회전 그래프로 시각화하는 컴포넌트
 *
 * - 마우스 드래그 3D 회전, 휠 확대/축소, 우클릭 패닝 지원
 * - 발행 폼(에메랄드)과 초안 폼(슬레이트)을 색상으로 구분하고 방향성 파티클로 참조 흐름 표현
 * - 노드 클릭 시 해당 폼의 라이브 캔버스(`/builder/forms/[id]`)로 즉시 이동
 */
export function BuilderRelationGraph({
  forms,
  isLoading = false,
  heightClassName = "h-[380px]",
}: BuilderRelationGraphProps) {
  const router = useRouter();
  const graphRef = React.useRef<ForceGraphMethods<Graph3DNode, Graph3DLink> | undefined>(undefined);
  const [hoveredNode, setHoveredNode] = React.useState<FormRelationGraphNode | null>(null);

  const graphData = React.useMemo(() => {
    const built = buildFormRelationGraph(forms ?? []);
    return {
      nodes: built.nodes.map((node) => ({ ...node })) as NodeObject<Graph3DNode>[],
      links: built.links.map((link) => ({ ...link })) as LinkObject<Graph3DNode, Graph3DLink>[],
    };
  }, [forms]);

  const handleResetView = React.useCallback(() => {
    graphRef.current?.zoomToFit(450, 48);
  }, []);

  const handleEngineStop = React.useCallback(() => {
    graphRef.current?.zoomToFit(350, 48);
  }, []);

  const handleNodeHover = React.useCallback((node: NodeObject<Graph3DNode> | null) => {
    setHoveredNode(node ?? null);
  }, []);

  const handleNodeClick = React.useCallback(
    (node: NodeObject<Graph3DNode>) => {
      if (node.id) {
        router.push(`/builder/forms/${node.id}`);
      }
    },
    [router]
  );

  const hoveredNodeId = hoveredNode?.id ?? null;
  const getNodeColor = React.useCallback(
    (node: NodeObject<Graph3DNode>) => {
      if (hoveredNodeId && hoveredNodeId === node.id) {
        return "#facc15";
      }
      return node.isPublished ? "#34d399" : "#38bdf8";
    },
    [hoveredNodeId]
  );

  if (isLoading) {
    return (
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-44 rounded-md" />
          <Skeleton className="h-3.5 w-72 rounded-md" />
        </CardHeader>
        <CardContent>
          <Skeleton className={cn("w-full rounded-lg", heightClassName)} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 overflow-hidden shadow-xs">
      <CardHeader className="border-border/50 flex flex-row flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Network className="text-primary size-4" />
            <CardTitle className="text-base font-semibold">3D 도메인 관계 그래프</CardTitle>
            <Badge variant="outline" className="text-[11px] font-normal">
              노드 {graphData.nodes.length} · 연결 {graphData.links.length}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            드래그로 3D 회전, 휠로 줌할 수 있으며 노드를 클릭하면 해당 폼 캔버스로 이동합니다.
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-muted-foreground flex items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-400" />
              발행됨
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-sky-400" />
              작성 중
            </span>
          </div>
          {graphData.nodes.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="gap-1.5 text-[11px]"
              onClick={handleResetView}
            >
              <Maximize2 className="size-3" />
              전체 맞추기
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {graphData.nodes.length === 0 ? (
          <div className="text-muted-foreground flex h-56 flex-col items-center justify-center gap-1 p-6 text-center text-xs">
            <p className="text-foreground font-medium">표시할 폼 관계 노드가 없습니다.</p>
            <p>AI Navigator로 폼을 생성하면 도메인 관계 구조가 3D 그래프로 시각화됩니다.</p>
          </div>
        ) : (
          <div className={cn("relative w-full bg-slate-950", heightClassName)}>
            <ForceGraph3DCanvas<Graph3DNode, Graph3DLink>
              graphRef={graphRef}
              graphData={graphData}
              backgroundColor="#070b14"
              showNavInfo={false}
              nodeResolution={16}
              nodeVal={getNodeVal}
              nodeColor={getNodeColor}
              nodeLabel={getNodeLabel}
              nodeThreeObjectExtend={true}
              nodeThreeObject={getNodeThreeObject}
              linkLabel={getLinkLabel}
              linkCurvature={getLinkCurvature}
              linkWidth={1.6}
              linkColor={getLinkColor}
              linkDirectionalArrowLength={4.5}
              linkDirectionalArrowRelPos={0.92}
              linkDirectionalParticles={2}
              linkDirectionalParticleWidth={1.8}
              linkDirectionalParticleSpeed={0.005}
              linkDirectionalParticleColor={getParticleColor}
              cooldownTicks={90}
              onEngineStop={handleEngineStop}
              onNodeHover={handleNodeHover}
              onNodeClick={handleNodeClick}
            />

            {/* 하단 인터랙션 상태 바 */}
            <div className="pointer-events-none absolute right-3 bottom-3 left-3 flex items-center justify-between gap-2">
              <div className="rounded-md border border-white/10 bg-slate-900/80 px-2.5 py-1 text-[11px] text-slate-200 backdrop-blur-xs">
                {hoveredNode ? (
                  <span>
                    <strong className="font-semibold text-white">{hoveredNode.title}</strong> · 필드{" "}
                    {hoveredNode.activeFieldCount}개 · 연결 {hoveredNode.relationDegree}건 (클릭해
                    열기)
                  </span>
                ) : (
                  <span className="text-slate-400">
                    노드에 마우스를 올리면 상세 정보가 표시됩니다.
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
