import Link from "next/link";
import { ArrowRight, BarChart3, FileText, Wrench, type LucideIcon } from "lucide-react";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/ui/card";
import { LandingOntologyBackground } from "./_components/landing-ontology-background";
import { WorkspaceAppBar } from "./_components/workspace-app-bar";

interface GatewayRoleItem {
  readonly id: "builder" | "consumer" | "analyst";
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly href: string;
  readonly icon: LucideIcon;
}

/**
 * 메인 게이트웨이(/)에서 선택할 수 있는 3개 작업 공간 역할 카드 메타데이터
 */
const GATEWAY_ROLES: readonly GatewayRoleItem[] = [
  {
    id: "builder",
    eyebrow: "Creator Environment",
    title: "빌더 (Builder)",
    description:
      "AI Navigator와 대화하며 실시간으로 폼 스키마와 관계형 필드를 설계·수정하고 발행합니다.",
    actionLabel: "빌더 시작하기",
    href: "/builder/forms",
    icon: Wrench,
  },
  {
    id: "consumer",
    eyebrow: "End-User Portal",
    title: "컨슈머 (Consumer)",
    description:
      "공식 발행된 데이터 폼에 레코드를 등록·조회하고, 분석가가 공유한 분석 뷰 리포트를 열람합니다.",
    actionLabel: "컨슈머 입장하기",
    href: "/consumer",
    icon: FileText,
  },
  {
    id: "analyst",
    eyebrow: "Knowledge Studio",
    title: "분석가 (Analyst)",
    description:
      "Analyst AI와 협업하여 복수 폼 응답 데이터를 비교·집계하고 블록 기반 분석 뷰 문서를 발행합니다.",
    actionLabel: "분석가 입장하기",
    href: "/analyst/views",
    icon: BarChart3,
  },
];

/**
 * 서비스 메인 게이트웨이 페이지 (/)
 *
 * 사용자의 역할에 따라 [빌더], [컨슈머], [분석가] 환경으로 진입할 수 있는 3자 역할 관문입니다.
 * 각 카드 전체를 링크 버튼 형태로 구성하여 클릭 및 키보드 포커스 시 즉각적인 인터랙션 피드백을 제공합니다.
 */
export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-zinc-50/50 font-sans dark:bg-black">
      <WorkspaceAppBar />
      <LandingOntologyBackground />
      <div className="relative z-10 flex flex-1 items-center justify-center p-6">
        <main className="flex w-full max-w-5xl flex-col items-center gap-10 text-center">
          {/* 서비스 헤더 */}
          <div className="space-y-3">
            <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Autonomous Form Engine
            </span>
            <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
              AI Dynamic Form Engine
            </h1>
            <p className="text-muted-foreground max-w-2xl text-base/relaxed sm:text-lg">
              자연어로 도메인 폼을 설계하는 빌더, 편리하게 응답을 제출하는 컨슈머, 수집 데이터를
              비교·시각화하여 리포트를 발행하는 분석가 환경을 제공합니다.
            </p>
          </div>

          {/* 3열 역할 선택 인터랙티브 카드 게이트웨이 */}
          <div className="grid w-full grid-cols-1 gap-6 text-left sm:grid-cols-3">
            {GATEWAY_ROLES.map((role) => {
              const Icon = role.icon;

              return (
                <Link
                  key={role.id}
                  href={role.href}
                  className="group focus-visible:ring-ring/50 block h-full rounded-xl outline-none focus-visible:ring-3"
                >
                  <Card className="bg-card/90 group-hover:ring-primary/40 group-hover:bg-accent/30 flex h-full flex-col justify-between shadow-xs backdrop-blur-xs transition-all duration-150 group-hover:-translate-y-0.5 group-hover:shadow-md group-active:translate-y-0 group-active:scale-[0.99] group-active:shadow-xs">
                    <CardHeader className="space-y-3 pt-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-primary text-xs font-semibold tracking-wider uppercase">
                          {role.eyebrow}
                        </span>
                        <span className="bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors">
                          <Icon className="size-4" />
                        </span>
                      </div>
                      <CardTitle className="text-foreground group-hover:text-primary text-xl font-bold transition-colors">
                        {role.title}
                      </CardTitle>
                      <CardDescription className="text-muted-foreground text-sm/relaxed">
                        {role.description}
                      </CardDescription>
                    </CardHeader>

                    <CardFooter className="group-hover:bg-primary/5 group-hover:text-primary justify-between py-3.5 text-sm font-medium transition-colors">
                      <span>{role.actionLabel}</span>
                      <ArrowRight className="text-muted-foreground group-hover:text-primary size-4 transition-transform duration-150 group-hover:translate-x-1" />
                    </CardFooter>
                  </Card>
                </Link>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
