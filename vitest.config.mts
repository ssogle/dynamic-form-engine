import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.ts"],
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
