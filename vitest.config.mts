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
    // ci runners are utc, where local time equals utc and no day is 23 or 25
    // hours long, so every assertion about local-clock and dst behaviour passed
    // for free. a zone with dst makes those tests mean what they say.
    env: { TZ: "America/Toronto" },
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
