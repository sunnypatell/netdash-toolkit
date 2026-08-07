import { vi } from "vitest"

// happy-dom lacks the browser apis tools touch on mount, so a crash for any other reason still fails

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}))

// the contexts import this at module scope; null services mirror a fresh clone with no env vars
vi.mock("@/lib/firebase", () => ({
  isFirebaseConfigured: () => false,
  auth: null,
  db: null,
  googleProvider: null,
  ensureAuth: async () => null,
  ensureFirestore: async () => null,
  hasStoredSession: async () => false,
  writeSessionHint: () => {},
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
