import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

const DOM_TEST_INCLUDES = [
  "src/**/hooks/**/*.test.ts",
  "src/**/queries/**/*.test.ts",
  "src/shared/lib/debounce/use-debounced-value.test.ts",
  "src/shared/lib/navigator-focus/navigator-focus.test.ts",
  "src/widgets/navigator-shell/lib/image-attachment.test.ts",
];

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: DOM_TEST_INCLUDES,
        },
      },
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          setupFiles: ["./vitest.setup.node.ts"],
          include: ["src/**/*.{test,spec}.ts"],
          exclude: ["**/node_modules/**", ...DOM_TEST_INCLUDES],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.ts",
        "src/**/index.ts",
        "src/**/server.ts",
        "src/app/**",
        "src/shared/ui/**",
        "src/**/ui/**",
        "src/**/types/**",
        "src/**/types.ts",
        "src/**/dto.ts",
        "src/**/d.ts",
      ],
    },
  },
});
