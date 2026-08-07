import { act, cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// the sdk loads on demand, so every step that was a module read is now a fetch that can fail

// setup.ts mocks @/lib/firebase project-wide; these tests want the real session detection
vi.unmock("@/lib/firebase")

const h = vi.hoisted(() => {
  const good = () => ({
    getAuth: () => ({ kind: "auth" }),
    GoogleAuthProvider: class {
      setCustomParameters() {}
    },
  })
  return { good, authImport: { fn: good as () => Record<string, unknown> }, calls: { n: 0 } }
})

vi.mock("firebase/app", () => ({
  initializeApp: () => ({ name: "app" }),
  getApps: () => [],
  getApp: () => ({ name: "app" }),
}))

vi.mock("firebase/auth", () => {
  h.calls.n += 1
  return h.authImport.fn()
})

const HINT_KEY = "netdash-auth-session"
const FIREBASE_DB = "firebaseLocalStorageDb"

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "key")
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "domain")
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "project")
  localStorage.clear()
  h.calls.n = 0
  h.authImport.fn = h.good
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("detecting a session without the sdk", () => {
  it("answers no for a visitor who has never signed in, and caches it", async () => {
    vi.stubGlobal("indexedDB", { databases: async () => [{ name: "some-other-db" }] })
    const { hasStoredSession } = await import("@/lib/firebase")

    expect(await hasStoredSession()).toBe(false)
    expect(localStorage.getItem(HINT_KEY), "the next load must not have to probe again").toBe("0")
  })

  it("answers yes when firebase auth has persisted a session here", async () => {
    vi.stubGlobal("indexedDB", { databases: async () => [{ name: FIREBASE_DB }] })
    const { hasStoredSession } = await import("@/lib/firebase")

    expect(await hasStoredSession()).toBe(true)
    expect(localStorage.getItem(HINT_KEY)).toBeNull()
  })

  it("never rejects when reading the indexedDB global itself throws", async () => {
    // firefox with site storage blocked: a rejection here leaves the auth provider loading forever
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError")
      },
    })
    try {
      const { hasStoredSession } = await import("@/lib/firebase")
      await expect(hasStoredSession()).resolves.toBe(true)
    } finally {
      // @ts-expect-error restoring the environment's own property
      delete globalThis.indexedDB
    }
  })

  it("never rejects when localStorage is blocked outright", async () => {
    vi.stubGlobal("indexedDB", { databases: async () => [] })
    const realGet = Storage.prototype.getItem
    const realSet = Storage.prototype.setItem
    Storage.prototype.getItem = () => {
      throw new DOMException("The operation is insecure.", "SecurityError")
    }
    Storage.prototype.setItem = () => {
      throw new DOMException("The operation is insecure.", "SecurityError")
    }
    try {
      const { hasStoredSession } = await import("@/lib/firebase")
      await expect(hasStoredSession()).resolves.toBe(false)
    } finally {
      Storage.prototype.getItem = realGet
      Storage.prototype.setItem = realSet
    }
  })

  it("does not load the sdk when firebase is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "")
    vi.resetModules()
    const { hasStoredSession, ensureAuth } = await import("@/lib/firebase")

    expect(await hasStoredSession()).toBe(false)
    expect(await ensureAuth()).toBeNull()
    expect(h.calls.n, "an unconfigured app must never import the sdk").toBe(0)
  })
})

describe("loading the sdk", () => {
  it("lets a retry succeed after a failed chunk fetch", async () => {
    h.authImport.fn = () => {
      if (h.calls.n === 1) throw new Error("ChunkLoadError")
      return h.good()
    }
    const { ensureAuth } = await import("@/lib/firebase")

    await expect(ensureAuth()).rejects.toThrow()
    // a rejected promise used to stay cached, so sign-in stayed broken for the rest of the session
    await expect(ensureAuth()).resolves.not.toBeNull()
    h.authImport.fn = h.good
  })
})

describe("the auth provider's loading flag", () => {
  const state = {
    ensureAuth: (async () => ({ auth: {}, googleProvider: {} })) as () => Promise<unknown>,
    hasStoredSession: (async () => true) as () => Promise<boolean>,
  }

  async function mountAuth() {
    vi.doMock("@/lib/firebase", () => ({
      isFirebaseConfigured: () => true,
      auth: null,
      db: null,
      googleProvider: null,
      ensureAuth: () => state.ensureAuth(),
      ensureFirestore: async () => null,
      hasStoredSession: () => state.hasStoredSession(),
      writeSessionHint: () => {},
    }))
    vi.resetModules()
    const { AuthProvider, useAuth } = await import("@/contexts/auth-context")
    const react = await import("react")
    let api: ReturnType<typeof useAuth> | null = null
    function Probe() {
      api = useAuth()
      return null
    }
    render(react.createElement(AuthProvider, null, react.createElement(Probe)))
    await waitFor(() => expect(api).not.toBeNull())
    return () => api!
  }

  afterEach(() => {
    cleanup()
    vi.doUnmock("@/lib/firebase")
  })

  it("stops spinning when the auth chunk fails to load", async () => {
    state.ensureAuth = async () => {
      throw new Error("ChunkLoadError: firebase auth")
    }
    state.hasStoredSession = async () => true
    const get = await mountAuth()

    await waitFor(() => expect(get().loading).toBe(false))
    expect(get().user).toBeNull()
  })

  it("stops spinning when the session probe rejects", async () => {
    state.ensureAuth = async () => ({ auth: {}, googleProvider: {} })
    state.hasStoredSession = async () => {
      throw new Error("indexedDB blocked")
    }
    const get = await mountAuth()

    await waitFor(() => expect(get().loading).toBe(false))
  })

  it("settles without touching the sdk for a visitor with no session", async () => {
    let loaded = false
    state.ensureAuth = async () => {
      loaded = true
      return { auth: {}, googleProvider: {} }
    }
    state.hasStoredSession = async () => false
    const get = await mountAuth()

    await waitFor(() => expect(get().loading).toBe(false))
    await act(async () => {
      await Promise.resolve()
    })
    expect(loaded, "a signed-out visitor must not pay for the sdk").toBe(false)
  })
})
