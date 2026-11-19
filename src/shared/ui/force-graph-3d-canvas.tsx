"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { ForceGraphMethods, ForceGraphProps, GraphData } from "react-force-graph-3d";
import { cn } from "@/shared/lib/cn";

const DynamicForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
}) as unknown as React.ComponentType<
  ForceGraphProps<Record<string, unknown>, Record<string, unknown>> & {
    ref?: React.Ref<ForceGraphMethods | undefined>;
  }
>;

const emptySubscribe = () => () => {};

/**
 * 세션 단위 WebGL 가용성 캐시
 *
 * `useSyncExternalStore`는 렌더링·하버·리사이즈마다 스냅샷 함수를 반복 호출하므로
 * 매 호출마다 임시 캔버스에 WebGL 컨텍스트를 생성하면 브라우저 상한(약 8~16개)을 초과해
 * 실제 Three.js 렌더러의 컨텍스트가 강제 해제(`Context Lost`)된다.
 * 최초 1회만 프로브한 뒤 확장 API(`WEBGL_lose_context`)로 즉시 반환하고 결과를 캐시한다.
 */
let cachedWebglSupport: boolean | null = null;

function getWebglSnapshot(): boolean {
  if (cachedWebglSupport !== null) {
    return cachedWebglSupport;
  }

  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const supported = Boolean(gl);

    if (gl) {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }

    cachedWebglSupport = supported;
    return supported;
  } catch {
    cachedWebglSupport = false;
    return false;
  }
}

function getWebglServerSnapshot(): boolean | null {
  return null;
}

export interface ForceGraph3DCanvasProps<
  NodeType extends Record<string, unknown> = Record<string, unknown>,
  LinkType extends Record<string, unknown> = Record<string, unknown>,
> extends Omit<ForceGraphProps<NodeType, LinkType>, "width" | "height" | "graphData"> {
  /** 렌더링할 3D 그래프 노드 및 링크 데이터 */
  graphData: GraphData<NodeType, LinkType>;
  /** 카메라/줌 제어를 위한 외부 ForceGraphMethods ref */
  graphRef?: React.Ref<ForceGraphMethods<NodeType, LinkType> | undefined> | undefined;
  /** WebGL 미지원 환경에서 표시할 대체 UI */
  fallback?: React.ReactNode | undefined;
  /** 컨테이너 추가 클래스명 */
  className?: string | undefined;
}

/**
 * Next.js SSR 격리(`ssr: false`), WebGL 컨텍스트 가용성 감지, ResizeObserver 반응형 크기 측정을
 * 캡슐화한 `react-force-graph-3d` 공용 3D 캔버스 래퍼 컴포넌트
 */
export function ForceGraph3DCanvas<
  NodeType extends Record<string, unknown> = Record<string, unknown>,
  LinkType extends Record<string, unknown> = Record<string, unknown>,
>({
  graphData,
  graphRef,
  fallback,
  className,
  ...graphProps
}: ForceGraph3DCanvasProps<NodeType, LinkType>) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const webglSupported = React.useSyncExternalStore(
    emptySubscribe,
    getWebglSnapshot,
    getWebglServerSnapshot
  );

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateSize = (width: number, height: number) => {
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height }
      );
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      updateSize(Math.floor(entry.contentRect.width), Math.floor(entry.contentRect.height));
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rawProps = graphProps as unknown as ForceGraphProps<
    Record<string, unknown>,
    Record<string, unknown>
  >;

  return (
    <div ref={containerRef} className={cn("relative h-full w-full overflow-hidden", className)}>
      {webglSupported === false ? (
        (fallback ?? (
          <div className="text-muted-foreground flex h-full w-full items-center justify-center p-6 text-center text-xs">
            현재 브라우저 환경에서 WebGL 3D 가속을 사용할 수 없습니다.
          </div>
        ))
      ) : webglSupported === true && size.width > 0 && size.height > 0 ? (
        <DynamicForceGraph3D
          ref={graphRef as React.Ref<ForceGraphMethods | undefined>}
          width={size.width}
          height={size.height}
          graphData={
            graphData as unknown as GraphData<Record<string, unknown>, Record<string, unknown>>
          }
          {...rawProps}
        />
      ) : null}
    </div>
  );
}
