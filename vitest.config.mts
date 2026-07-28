// pure-logic unit tests only (lib/ + electron parsers), node env, no dom.
// component testing is out of scope: the load-bearing logic is the networking
// math and the vendor-output parsers, and both live in framework-free modules.
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
})
