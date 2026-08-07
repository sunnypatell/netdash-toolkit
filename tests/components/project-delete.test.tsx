import { act, cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// a deleted project came back after a refresh; the two paths that resurrect one are covered here

type Doc = { id: string; data: Record<string, unknown> }
type Emit = (docs: Doc[]) => void

const deleted: string[] = []
const uploaded: string[] = []
const sharesCleanedUp: string[] = []
// one per mounted provider, so a two-tab test can drive each listener separately
const emitters: Emit[] = []
let currentUser: { uid: string; email: string } | null = null
let authLoading = false
let deleteBehaviour: (id: string) => Promise<void> = async () => {}

vi.mock("@/lib/firebase", () => ({
  isFirebaseConfigured: () => true,
  auth: {},
  db: {},
  googleProvider: null,
  ensureAuth: async () => ({ auth: {}, googleProvider: {} }),
  ensureFirestore: async () => ({}),
  hasStoredSession: async () => true,
  writeSessionHint: () => {},
}))

vi.mock("@/contexts/auth-context", async () => {
  const react = await import("react")
  return {
    useAuth: () => ({ user: currentUser, loading: authLoading }),
    AuthProvider: ({ children }: { children: React.ReactNode }) =>
      react.createElement(react.Fragment, null, children),
  }
})

vi.mock("firebase/firestore", () => ({
  collection: (...path: unknown[]) => ({ path }),
  doc: (_db: unknown, ...path: string[]) => ({ id: path[path.length - 1], path }),
  query: (ref: unknown) => ref,
  orderBy: () => ({}),
  where: () => ({}),
  getDoc: async () => ({ exists: () => false, data: () => undefined }),
  getDocs: async () => ({ forEach: () => {}, docs: [] }),
  setDoc: async (ref: { id: string }) => {
    uploaded.push(ref.id)
  },
  deleteDoc: async (ref: { id: string }) => {
    await deleteBehaviour(ref.id)
    deleted.push(ref.id)
  },
  onSnapshot: (_q: unknown, onNext: (snap: unknown) => void) => {
    const emit: Emit = (docs) =>
      onNext({
        forEach: (fn: (d: { id: string; data: () => Record<string, unknown> }) => void) =>
          docs.forEach((d) => fn({ id: d.id, data: () => d.data })),
      })
    emitters.push(emit)
    return () => {
      const i = emitters.indexOf(emit)
      if (i >= 0) emitters.splice(i, 1)
    }
  },
  serverTimestamp: () => Date.now(),
  Timestamp: { now: () => Date.now() },
}))

vi.mock("@/lib/sharing", () => ({
  deleteAllSharesForProject: async (ownerId: string, projectId: string) => {
    sharesCleanedUp.push(`${ownerId}/${projectId}`)
  },
  subscribeToSharedProjects: () => () => {},
  updateUserIndex: async () => {},
  shareProject: async () => {},
  unshareProject: async () => {},
  getSharedProject: async () => null,
  subscribeToSharedProject: () => () => {},
  updateIsSharedFlag: async () => {},
  findUserByEmail: async () => null,
}))

const STORAGE_KEY = "netdash-projects"
const TOMBSTONE_KEY = "netdash-deleted-projects"
const CLOUD_P1: Doc[] = [{ id: "p1", data: { name: "Site A", items: [], updatedAt: 1 } }]

function seed(id: string, name: string) {
  const project = {
    id,
    name,
    description: "",
    items: [],
    tags: [],
    createdAt: 1,
    updatedAt: 1,
    ownerId: "uid-1",
    ownerEmail: "a@example.com",
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify([project]))
  return project
}

function storedIds(): string[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]").map(
    (p: { id: string }) => p.id
  ) as string[]
}

function tombstonedIds(): string[] {
  const raw: Array<string | [string, string | null]> = JSON.parse(
    localStorage.getItem(TOMBSTONE_KEY) ?? "[]"
  )
  return raw.map((entry) => (Array.isArray(entry) ? entry[0] : entry))
}

beforeEach(() => {
  localStorage.clear()
  deleted.length = 0
  uploaded.length = 0
  sharesCleanedUp.length = 0
  emitters.length = 0
  currentUser = { uid: "uid-1", email: "a@example.com" }
  authLoading = false
  deleteBehaviour = async () => {}
})

afterEach(() => {
  cleanup()
  vi.resetModules()
})

async function mountProvider() {
  // firestore loads on demand, so without waiting for this mount's listener every emit is a no-op
  const before = emitters.length
  const { ProjectProvider, useProjects } = await import("@/contexts/project-context")
  const react = await import("react")
  let api: ReturnType<typeof useProjects> | null = null
  function Probe() {
    api = useProjects()
    return null
  }
  const view = render(react.createElement(ProjectProvider, null, react.createElement(Probe)))
  await waitFor(() => expect(api).not.toBeNull())
  await waitFor(() => expect(api!.loading).toBe(false))
  if (currentUser) await waitFor(() => expect(emitters.length).toBeGreaterThan(before))
  return { get: () => api!, view, emit: (docs: Doc[]) => emitters[before](docs) }
}

describe("deleting a saved project", () => {
  it("removes it from local storage so a refresh cannot bring it back", async () => {
    const project = seed("p1", "Site A")
    const { get } = await mountProvider()
    await waitFor(() => expect(get().projects).toHaveLength(1))

    await act(async () => {
      await get().deleteProject(project.id)
    })

    expect(storedIds()).toEqual([])
    expect(deleted, "the cloud copy must actually be deleted").toContain("p1")
  })

  it("does not report success while auth has not resolved", async () => {
    // the token is refreshing, so a local-only delete leaves the cloud copy for the next snapshot
    const project = seed("p1", "Site A")
    currentUser = null
    authLoading = true
    const { get } = await mountProvider()
    await waitFor(() => expect(get().projects).toHaveLength(1))

    let result: { success: boolean; error?: string } | undefined
    await act(async () => {
      result = await get().deleteProject(project.id)
    })

    expect(
      result?.success,
      "reporting success without deleting the cloud copy is what resurrects it"
    ).toBe(false)
    expect(deleted).not.toContain("p1")
  })

  it("never re-uploads a project the user deleted", async () => {
    const project = seed("p1", "Site A")
    const { get, emit } = await mountProvider()
    await waitFor(() => expect(get().projects).toHaveLength(1))

    await act(async () => {
      await get().deleteProject(project.id)
    })

    // a snapshot that still carries the project, as an in-flight one would
    await act(async () => {
      emit(CLOUD_P1)
    })

    expect(get().projects.map((p) => p.id)).not.toContain("p1")
    expect(uploaded, "a deleted project must never be uploaded again").not.toContain("p1")
    expect(storedIds()).toEqual([])
  })

  it("lets a signed-out visitor delete their own local work", async () => {
    // auth settled with no account; refusing said "delete failed" while a tombstone removed it anyway
    const project = seed("p1", "Site A")
    currentUser = null
    const { get } = await mountProvider()
    await waitFor(() => expect(get().projects).toHaveLength(1))

    let result: { success: boolean; error?: string } | undefined
    await act(async () => {
      result = await get().deleteProject(project.id)
    })

    expect(result?.success).toBe(true)
    expect(get().projects.map((p) => p.id)).toEqual([])
    expect(storedIds()).toEqual([])
  })

  it("deletes the cloud copy of a signed-out delete once the user signs in", async () => {
    const project = seed("p1", "Site A")
    currentUser = null
    const out = await mountProvider()
    await waitFor(() => expect(out.get().projects).toHaveLength(1))
    await act(async () => {
      await out.get().deleteProject(project.id)
    })
    out.view.unmount()
    vi.resetModules()

    currentUser = { uid: "uid-1", email: "a@example.com" }
    const back = await mountProvider()
    await act(async () => {
      back.emit(CLOUD_P1)
    })

    await waitFor(() => expect(deleted).toContain("p1"))
    expect(back.get().projects.map((p) => p.id)).not.toContain("p1")
    expect(uploaded).not.toContain("p1")
  })

  it("does not re-upload a project a second tab deleted", async () => {
    seed("p1", "Site A")
    const tabA = await mountProvider()
    const tabB = await mountProvider()
    await waitFor(() => expect(tabB.get().projects).toHaveLength(1))
    await act(async () => {
      tabA.emit(CLOUD_P1)
      tabB.emit(CLOUD_P1)
    })

    await act(async () => {
      await tabA.get().deleteProject("p1")
    })
    uploaded.length = 0

    // tab B never saw the delete: its tombstones only exist on disk
    await act(async () => {
      tabB.emit([])
    })

    expect(uploaded, "the other tab must not put back what this one deleted").not.toContain("p1")
    expect(tabB.get().projects.map((p) => p.id)).not.toContain("p1")
  })

  it("keeps a project usable when the cloud delete is rejected", async () => {
    const project = seed("p1", "Site A")
    deleteBehaviour = async () => {
      throw new Error("permission-denied")
    }
    const { get, emit } = await mountProvider()
    await waitFor(() => expect(get().projects).toHaveLength(1))

    let result: { success: boolean } | undefined
    await act(async () => {
      result = await get().deleteProject(project.id)
    })
    expect(result?.success).toBe(false)
    // checked before any snapshot: a tombstone here hides a project whose cloud copy is intact
    expect(
      tombstonedIds(),
      "the cloud copy is intact, so nothing should still be marked deleted"
    ).not.toContain("p1")

    // the copy survived, so the next snapshot still carries it
    await act(async () => {
      emit(CLOUD_P1)
    })

    expect(
      get().projects.map((p) => p.id),
      "hiding a project whose delete failed leaves the user nothing to retry"
    ).toContain("p1")
    expect(tombstonedIds()).not.toContain("p1")
  })

  it("still hides a delete that is only half done when the tab reloads", async () => {
    // the tombstone is written before the request, so a reload mid-flight must not restore it
    seed("p1", "Site A")
    deleteBehaviour = () => new Promise<void>(() => {})
    const first = await mountProvider()
    await waitFor(() => expect(first.get().projects).toHaveLength(1))
    void first.get().deleteProject("p1")
    await act(async () => {
      await Promise.resolve()
    })
    first.view.unmount()
    vi.resetModules()
    deleteBehaviour = async () => {}

    const second = await mountProvider()
    expect(second.get().projects.map((p) => p.id)).not.toContain("p1")
  })

  it("removes the share records so collaborators stop seeing a deleted project", async () => {
    // projectShares is a separate top level collection, so collaborators are left pointed at nothing
    const project = seed("p1", "Site A")
    const { get } = await mountProvider()
    await waitFor(() => expect(get().projects).toHaveLength(1))

    await act(async () => {
      await get().deleteProject(project.id)
    })

    expect(sharesCleanedUp).toContain("uid-1/p1")
  })

  it("only lets the owning account retire a tombstone", async () => {
    // the delete never lands, so the tombstone has to outlive a detour through another account
    seed("p1", "Site A")
    deleteBehaviour = () => new Promise<void>(() => {})
    const a = await mountProvider()
    await waitFor(() => expect(a.get().projects).toHaveLength(1))
    void a.get().deleteProject("p1")
    await act(async () => {
      await Promise.resolve()
    })
    expect(tombstonedIds()).toEqual(["p1"])
    a.view.unmount()
    vi.resetModules()

    currentUser = { uid: "uid-2", email: "b@example.com" }
    const b = await mountProvider()
    await act(async () => {
      b.emit([])
    })

    expect(
      tombstonedIds(),
      "another account's snapshot says nothing about this account's copy"
    ).toEqual(["p1"])
  })
})
