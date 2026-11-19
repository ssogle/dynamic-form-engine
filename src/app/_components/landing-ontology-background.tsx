"use client";

import * as React from "react";
import type { ForceGraphMethods, LinkObject, NodeObject } from "react-force-graph-3d";
import { ForceGraph3DCanvas } from "@/shared/ui/force-graph-3d-canvas";

interface LandingOntologyNode extends Record<string, unknown> {
  id: string;
  group: "master" | "operation" | "insight";
  val: number;
}

interface LandingOntologyLink extends Record<string, unknown> {
  source: string;
  target: string;
  curvature: number;
}

const SAMPLE_NODES: LandingOntologyNode[] = [
  { id: "client", group: "master", val: 8 },
  { id: "member", group: "master", val: 7 },
  { id: "project", group: "master", val: 11 },
  { id: "vendor", group: "master", val: 6 },
  { id: "worklog", group: "operation", val: 9 },
  { id: "expense", group: "operation", val: 8 },
  { id: "purchase", group: "operation", val: 8 },
  { id: "receipt", group: "operation", val: 7 },
  { id: "analytics", group: "insight", val: 10 },
];

const SAMPLE_LINKS: LandingOntologyLink[] = [
  { source: "project", target: "client", curvature: 0.1 },
  { source: "project", target: "member", curvature: -0.1 },
  { source: "worklog", target: "project", curvature: 0.15 },
  { source: "worklog", target: "member", curvature: 0.1 },
  { source: "expense", target: "project", curvature: -0.2 },
  { source: "expense", target: "member", curvature: -0.1 },
  { source: "purchase", target: "vendor", curvature: 0.15 },
  { source: "purchase", target: "project", curvature: 0.2 },
  { source: "receipt", target: "purchase", curvature: 0.12 },
  { source: "analytics", target: "expense", curvature: 0.1 },
  { source: "analytics", target: "worklog", curvature: -0.15 },
  { source: "analytics", target: "purchase", curvature: 0.18 },
];

/**
 * 랜딩 페이지(/) 배경에서 DB 조회 없이 동작하는 자동 회전(Auto-Orbit) 3D 도메인 온톨로지 그래프
 *
 * `pointer-events-none` 배경 레이어로 동작해 카드 UI 인터랙션을 방해하지 않으며,
 * `prefers-reduced-motion` 환경에서는 카메라 자동 회전을 멈추어 접근성을 준수합니다.
 */
export function LandingOntologyBackground() {
  const graphRef = React.useRef<
    ForceGraphMethods<LandingOntologyNode, LandingOntologyLink> | undefined
  >(undefined);

  const graphData = React.useMemo(
    () => ({
      nodes: SAMPLE_NODES.map((n) => ({ ...n })) as NodeObject<LandingOntologyNode>[],
      links: SAMPLE_LINKS.map((l) => ({ ...l })) as LinkObject<
        LandingOntologyNode,
        LandingOntologyLink
      >[],
    }),
    []
  );

  React.useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      return;
    }

    let frameId = 0;
    let angle = 0;
    const distance = 260;

    const orbit = () => {
      angle += 0.0022;
      graphRef.current?.cameraPosition({
        x: distance * Math.sin(angle),
        y: 35 * Math.sin(angle * 0.7),
        z: distance * Math.cos(angle),
      });
      frameId = requestAnimationFrame(orbit);
    };

    frameId = requestAnimationFrame(orbit);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 opacity-60 dark:opacity-55"
    >
      <ForceGraph3DCanvas<LandingOntologyNode, LandingOntologyLink>
        graphRef={graphRef}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)"
        showNavInfo={false}
        enablePointerInteraction={false}
        enableNavigationControls={false}
        enableNodeDrag={false}
        nodeResolution={12}
        nodeOpacity={0.72}
        nodeVal={(node) => node.val}
        nodeColor={(node) => {
          if (node.group === "master") return "#10b981";
          if (node.group === "insight") return "#8b5cf6";
          return "#38bdf8";
        }}
        linkWidth={1.1}
        linkOpacity={0.35}
        linkCurvature={(link) => link.curvature}
        linkColor={() => "#94a3b8"}
        linkDirectionalParticles={1}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleSpeed={0.004}
        linkDirectionalParticleColor={() => "#60a5fa"}
        cooldownTicks={80}
      />
    </div>
  );
}
