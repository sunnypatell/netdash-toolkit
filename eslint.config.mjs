import { createRequire } from "node:module"
import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

// eslint-config-next's base block skips .cjs; the old --ext list covered it
const LINT_TARGETS = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"]

// eslint-plugin-react's "detect" path calls context.getFilename(), removed in eslint 10
const reactVersion = createRequire(import.meta.url)("react/package.json").version

const next = [...nextCoreWebVitals, ...nextTypescript].map((config) =>
  config.name === "next"
    ? {
        ...config,
        files: LINT_TARGETS,
        settings: { ...config.settings, react: { version: reactVersion } },
      }
    : config
)

const config = [
  {
    ignores: [
      "node_modules/",
      ".next/",
      "out/",
      "build/",
      "dist-electron/",
      "release/",
      "public/",
      "docs/dist/",
      "docs/.astro/",
      "docs/node_modules/",
      // agent worktrees are full checkouts of this repo; linting them doubles
      // every finding and reports files that are not in the tree
      ".claude/",
      "next-env.d.ts",
    ],
  },
  ...next,
  {
    files: LINT_TARGETS,
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "react/no-unescaped-entities": "warn",
      // new in react-hooks 7 (via eslint-config-next 16). fires on 22 deliberate sites where a
      // client-only value cannot exist until after hydration; revisit with the react 19 migration
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["tests/**"],
    rules: {
      "react/no-children-prop": "off",
    },
  },
  {
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["docs/**"],
    rules: {
      "@next/next/no-assign-module-variable": "off",
    },
  },
]

export default config
