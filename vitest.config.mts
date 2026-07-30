// two projects, two environments:
// - unit: pure logic (lib/ + electron parsers) in node, no dom
// - components: mounts every tool in happy-dom to catch render crashes. this
//   is the cheap rigorous substitute for clicking through 48 tools by hand.
//   happy-dom over jsdom: faster, and jsdom 30 needs node 22 via undici.
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // tsconfig sets jsx: preserve for next, so tests need their own transform
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "happy-dom",
          include: ["tests/components/**/*.test.tsx"],
          setupFiles: ["tests/components/setup.ts"],
        },
      },
    ],
  },
})
