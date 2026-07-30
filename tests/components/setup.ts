import { vi } from "vitest"

// happy-dom lacks the browser apis tool components touch on mount. stubbing them
// here rather than per-test keeps the render smoke suite honest: a tool that
// crashes for any other reason still fails.

// next/navigation: tools that read the route
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}))

// firebase is imported at module scope by the contexts; never hit the network.
// mirrors the real module: unconfigured means null services, as on a fresh
// clone with no env vars.
vi.mock("@/lib/firebase", () => ({
  isFirebaseConfigured: () => false,
  auth: null,
  db: null,
  googleProvider: null,
}))

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

// radix measures elements and observes resizes
for (const name of ["ResizeObserver", "IntersectionObserver"] as const) {
  if (!(name in window)) {
    // @ts-expect-error assigning a test double onto the global
    window[name] = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn()
}

Object.defineProperty(navigator, "clipboard", {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  configurable: true,
})
