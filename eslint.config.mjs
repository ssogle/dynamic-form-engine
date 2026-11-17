import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";
import checkFile from "eslint-plugin-check-file";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // 기본 무시 대상 설정
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "node_modules/**",
  ]),

  // FSD 아키텍처 경계 검증 및 파일명 컨벤션 규칙
  {
    plugins: {
      boundaries,
      "check-file": checkFile,
    },
    settings: {
      // FSD 레이어 및 슬라이스 엘리먼트 정의
      // widgets, features, entities는 슬라이스 폴더 단위(*)로 엘리먼트 경계를 지정하여
      // 동일 레이어 내 슬라이스 간 교차 참조(Cross-slice import)를 차단하고 Public API(index.ts)를 강제합니다.
      "boundaries/elements": [
        { type: "app", pattern: "src/app" },
        { type: "widgets", pattern: "src/widgets/*" },
        { type: "features", pattern: "src/features/*" },
        { type: "entities", pattern: "src/entities/*" },
        { type: "shared", pattern: "src/shared" },
      ],
      "boundaries/ignore": ["**/*.test.*", "**/*.spec.*", "**/*.d.ts"],
    },
    rules: {
      // 1. 미정의 의존성 차단
      "boundaries/no-unknown-dependencies": ["error"],

      // 2. FSD 단방향 참조 원칙 및 Public API 강제 (최신 boundaries/dependencies 셀렉터 통합 방식)
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            // app: app 내부 및 모든 하위 레이어 허용 (widgets는 index.ts만, features와 entities는 index.ts 및 server.ts 허용)
            {
              from: { element: { type: "app" } },
              allow: [
                { to: { element: { type: "app" } } },
                { to: { element: { type: "widgets", fileInternalPath: "index.{ts,tsx}" } } },
                {
                  to: {
                    element: { type: "features", fileInternalPath: "{index,server}.{ts,tsx}" },
                  },
                },
                {
                  to: {
                    element: { type: "entities", fileInternalPath: "{index,server}.{ts,tsx}" },
                  },
                },
                { to: { element: { type: "shared" } } },
              ],
            },
            // widgets: widgets 내부(동일 슬라이스 자동 허용) 및 features, entities (index.ts만), shared 허용
            {
              from: { element: { type: "widgets" } },
              allow: [
                { to: { element: { type: "features", fileInternalPath: "index.{ts,tsx}" } } },
                { to: { element: { type: "entities", fileInternalPath: "index.{ts,tsx}" } } },
                { to: { element: { type: "shared" } } },
              ],
            },
            // features: features 내부(동일 슬라이스 자동 허용) 및 entities ({index,server}.{ts,tsx}), shared 허용
            {
              from: { element: { type: "features" } },
              allow: [
                {
                  to: {
                    element: { type: "entities", fileInternalPath: "{index,server}.{ts,tsx}" },
                  },
                },
                { to: { element: { type: "shared" } } },
              ],
            },
            // entities: entities 내부(동일 슬라이스 자동 허용) 및 shared 허용
            {
              from: { element: { type: "entities" } },
              allow: [{ to: { element: { type: "shared" } } }],
            },
            // shared: shared 내부만 상호 참조 허용
            {
              from: { element: { type: "shared" } },
              allow: [{ to: { element: { type: "shared" } } }],
            },
          ],
        },
      ],

      // 3. 파일명 컨벤션 (kebab-case 강제)
      "check-file/filename-naming-convention": [
        "error",
        {
          "src/**/!(*.d).{ts,tsx}": "KEBAB_CASE",
        },
        {
          ignoreMiddleExtensions: true,
        },
      ],

      // 4. 세그먼트별 파일 확장자 접미사(suffix) 격리 강제
      "check-file/folder-match-with-fex": [
        "error",
        {
          "*.hook.{ts,tsx}": "**/hooks/",
          "*.table.{ts,tsx}": "**/tables/",
          "*.store.{ts,tsx}": "**/store/",
          "*.schema.{ts,tsx}": "**/schema/",
          "*.server.{ts,tsx}": "**/server/",
          "*.query.{ts,tsx}": "**/queries/",
          "*.mutation.{ts,tsx}": "**/queries/",
          "*.keys.{ts,tsx}": "**/queries/",
          "*.types.{ts,tsx}": "**/types/",
          "*.dto.{ts,tsx}": "**/types/",
        },
      ],

      // 5. 비표준 세그먼트 폴더 및 세그먼트 내부 파일 접미사 누락 차단
      "check-file/filename-blocklist": [
        "error",
        {
          // 슬라이스 내부 비표준 세그먼트 폴더 차단 (8대 표준 세그먼트만 허용, 슬라이스 루트 index.{ts,tsx}는 허용)
          "src/{widgets,features,entities}/*/!(ui|queries|server|store|schema|types|lib|hooks|index.ts|index.tsx)/**":
            "src/**/{ui,queries,server,store,schema,types,lib,hooks}/**",

          // hooks 폴더 내 파일은 반드시 use- 접두사와 .hook.ts 접미사를 가져야 함 (테스트 및 index 제외)
          "src/**/hooks/**/!(use-*.hook|use-*.hook.test|index).{ts,tsx}": "use-*.hook.ts",

          // tables 폴더 내 파일은 반드시 .table.ts 접미사를 가져야 함 (테스트 및 index 제외)
          "src/**/tables/**/!(*.table|*.table.test|index).{ts,tsx}": "*.table.ts",

          // store 폴더 내 파일은 반드시 .store.ts 접미사를 가져야 함 (테스트 및 index 제외)
          "src/**/store/**/!(*.store|*.store.test|index).{ts,tsx}": "*.store.ts",

          // schema 폴더 내 파일은 반드시 .schema.ts 접미사를 가져야 함
          "src/**/schema/**/!(*.schema|*.schema.test|index).{ts,tsx}": "*.schema.ts",

          // server 폴더 내 파일은 반드시 .server.ts 접미사를 가져야 함
          "src/**/server/**/!(*.server|*.server.test|index).{ts,tsx}": "*.server.ts",

          // queries 폴더 내 파일은 반드시 .query.ts, .mutation.ts, 또는 .keys.ts 접미사를 가져야 함
          "src/**/queries/**/!(*.query|*.mutation|*.keys|*.query.test|*.mutation.test|*.keys.test|index).{ts,tsx}":
            "*.query.ts, *.mutation.ts, 또는 *.keys.ts",

          // types 폴더 내 파일은 반드시 .types.ts 또는 .dto.ts 접미사를 가져야 함 (index 제외)
          "src/**/types/**/!(*.types|*.dto|index).{ts,tsx}": "*.types.ts 또는 *.dto.ts",
        },
      ],

      // 6. 디렉터리 폴더명 컨벤션 (kebab-case 강제, Next.js 동적 라우팅 세그먼트가 포함된 src/app은 제외)
      "check-file/folder-naming-convention": [
        "error",
        {
          "src/!(app)/**": "KEBAB_CASE",
        },
      ],

      // 7. 함수형 프로그래밍 가드레일 (클래스 및 this 키워드 원천 차단)
      "no-restricted-syntax": [
        "error",
        {
          selector: "ClassDeclaration",
          message:
            "본 프로젝트에서는 클래스(class) 작성이 금지됩니다. 순수 함수와 객체 팩토리를 사용하세요.",
        },
        {
          selector: "ThisExpression",
          message:
            "함수형 코드베이스에서는 'this' 키워드 사용이 금지됩니다. 인자를 통한 순수 함수로 작성하세요.",
        },
      ],
      "prefer-const": "error",
      "no-var": "error",
    },
  },

  // 8. TypeScript 타입 인지 Deprecated 가드레일 (warn 레벨)
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-deprecated": "warn",
    },
  },

  // 9. 서드파티 라이브러리(date-fns, cn) 직접 import 차단 및 공통 lib 단일 창구 강제 가드레일
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["src/shared/lib/date/date.ts", "src/shared/lib/cn/cn.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "date-fns",
              message:
                "서드파티 시간 라이브러리 직접 import는 금지됩니다. 반드시 '@/shared/lib/date'의 formatDate, formatRelativeTime 등을 사용하세요.",
            },
            {
              name: "date-fns/locale",
              message:
                "서드파티 로케일 직접 import는 금지됩니다. 반드시 '@/shared/lib/date'의 날짜 함수를 사용하세요.",
            },
            {
              name: "cn",
              message:
                "외부 'cn' 패키지 직접 import는 금지됩니다. 반드시 '@/shared/lib/cn'을 사용하세요.",
            },
          ],
          patterns: [
            {
              group: ["date-fns/*"],
              message:
                "서드파티 시간 라이브러리 하위 모듈 직접 import는 금지됩니다. 반드시 '@/shared/lib/date'를 사용하세요.",
            },
            {
              group: ["cn/*"],
              message:
                "외부 'cn' 패키지 하위 모듈 직접 import는 금지됩니다. 반드시 '@/shared/lib/cn'을 사용하세요.",
            },
          ],
        },
      ],
    },
  },

  // 10. Zod 스키마 정의 위치 단일화 가드레일 (schema/*.schema.ts 외 도메인/피처/라우트에서 zod 직접 import 차단)
  // ESLint flat config는 동일 규칙명을 마지막 매칭 블록으로 덮어쓰므로, 9번의 date-fns/cn 차단을 함께 병합합니다.
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: [
      "src/**/schema/*.schema.ts",
      "src/shared/lib/http/server.ts",
      "src/shared/lib/date/date.ts",
      "src/shared/lib/cn/cn.ts",
      "src/app/api/v1/_lib/request-helpers.ts",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "date-fns",
              message:
                "서드파티 시간 라이브러리 직접 import는 금지됩니다. 반드시 '@/shared/lib/date'의 formatDate, formatRelativeTime 등을 사용하세요.",
            },
            {
              name: "date-fns/locale",
              message:
                "서드파티 로케일 직접 import는 금지됩니다. 반드시 '@/shared/lib/date'의 날짜 함수를 사용하세요.",
            },
            {
              name: "cn",
              message:
                "외부 'cn' 패키지 직접 import는 금지됩니다. 반드시 '@/shared/lib/cn'을 사용하세요.",
            },
            {
              name: "zod",
              message:
                "런타임 Zod 스키마는 반드시 'schema/*.schema.ts' 세그먼트에만 정의해야 합니다. 다른 세그먼트에서는 스키마 파일이 export한 스키마 심볼이나 z.infer/z.input 파생 타입만 import하세요.",
            },
            {
              name: "drizzle-zod",
              message:
                "drizzle-zod 스키마 생성은 반드시 'schema/*.schema.ts' 세그먼트 내부에서만 수행해야 합니다.",
            },
          ],
          patterns: [
            {
              group: ["date-fns/*"],
              message:
                "서드파티 시간 라이브러리 하위 모듈 직접 import는 금지됩니다. 반드시 '@/shared/lib/date'를 사용하세요.",
            },
            {
              group: ["cn/*"],
              message:
                "외부 'cn' 패키지 하위 모듈 직접 import는 금지됩니다. 반드시 '@/shared/lib/cn'을 사용하세요.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/shared/lib/cn/cn.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "date-fns",
              message:
                "서드파티 시간 라이브러리 직접 import는 금지됩니다. 반드시 '@/shared/lib/date'를 사용하세요.",
            },
            {
              name: "zod",
              message:
                "런타임 Zod 스키마는 반드시 'schema/*.schema.ts' 세그먼트에만 정의해야 합니다.",
            },
            {
              name: "drizzle-zod",
              message:
                "drizzle-zod 스키마 생성은 반드시 'schema/*.schema.ts' 세그먼트 내부에서만 수행해야 합니다.",
            },
          ],
          patterns: [
            {
              group: ["date-fns/*"],
              message:
                "서드파티 시간 라이브러리 하위 모듈 직접 import는 금지됩니다. 반드시 '@/shared/lib/date'를 사용하세요.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
