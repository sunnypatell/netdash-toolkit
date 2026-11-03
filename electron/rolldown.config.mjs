import { defineConfig } from "rolldown"

// serve-handler and its tree are inlined, so the packaged app ships no node_modules at all
export default defineConfig({
  input: { main: "electron/main.ts", preload: "electron/preload.ts" },
  platform: "node",
  external: ["electron"],
  output: {
    dir: "dist-electron",
    format: "cjs",
    sourcemap: true,
    cleanDir: true,
    entryFileNames: "[name].js",
  },
})
