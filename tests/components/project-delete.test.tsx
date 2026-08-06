import { act, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// this suite exists because a deleted project came back after a refresh. the
// paths that can resurrect one are: reporting success without reaching the
// cloud, and the snapshot merge treating a deleted project as "local only" and
// uploading it again. both are covered here against a fake firestore.

const deleted: string[] = []
const uploaded: string[] = []
let emitSnapshot: ((docs: Array<{ id: string; data: Record<string, unknown> }>) => void) | null =
  null
let currentUser: { uid: string; email: string } | null = null

vi.mock("@/lib/firebase", () => ({
  isFirebaseConfigured: () => true,
  auth: {},
  db: {},
  googleProvider: null,
}))

vi.mock("@/contexts/auth-context", async () => {
  const react = await import("react")
  return {
    useAuth: () => ({ user: currentUser }),
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
    deleted.push(ref.id)
  },
  onSnapshot: (_q: unknown, onNext: (snap: unknown) => void) => {
    emitSnapshot = (docs) =>
      onNext({
        forEach: (fn: (d: { id: string; data: () => Record<string, unknown> }) => void) =>
          docs.forEach((d) => fn({ id: d.id, data: () => d.data })),
      })
    return () => {
      emitSnapshot = null
    }
  },
  serverTimestamp: () => Date.now(),
  Timestamp: { now: () => Date.now() },
}))

vi.mock("@/lib/sharing", () => ({
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

beforeEach(() => {
  localStorage.clear()
  deleted.length = 0
  uploaded.length = 0
  emitSnapshot = null
  currentUser = { uid: "uid-1", email: "a@example.com" }
})

afterEach(() => {
  vi.resetModules()
})

async function mountProvider() {
  const { ProjectProvider, useProjects } = await import("@/contexts/project-context")
  const react = await import("react")
  let api: ReturnType<typeof useProjects> | null = null
  function Probe() {
    api = useProjects()
    return null
  }
  render(react.createElement(ProjectProvider, null, react.createElement(Probe)))
  await waitFor(() => expect(api).not.toBeNull())
  return () => api!
}

describe("deleting a saved project", () => {
  it("removes it from local storage so a refresh cannot bring it back", async () => {
    const project = seed("p1", "Site A")
    const get = await mountProvider()
    await waitFor(() => expect(get().projects).toHaveLength(1))

    await act(async () => {
      await get().deleteProject(project.id)
    })

    expect(storedIds()).toEqual([])
    expect(deleted, "the cloud copy must actually be deleted").toContain("p1")
  })

  it("does not report success when it never reached the cloud", async () => {
    // auth has not resolved yet. the project is already in the cloud, so a
    // local-only delete leaves it there and the next snapshot restores it.
    const project = seed("p1", "Site A")
    currentUser = null
    const get = await mountProvider()
    await waitFor(() => expect(get().projects).toHaveLength(1))

    let result: { success: boolean; error?: string } | undefined
    await act(async () => {
      result = await get().deleteProject(project.id)
    })

    expect(
      result?.success,
      "reporting success without deleting the cloud copy is what resurrects it"
    ).toBe(false)
  })

  it("never re-uploads a project the user deleted", async () => {
    const project = seed("p1", "Site A")
    const get = await mountProvider()
    await waitFor(() => expect(get().projects).toHaveLength(1))

    await act(async () => {
      await get().deleteProject(project.id)
    })

    // a snapshot that still carries the project, as an in-flight one would
    await act(async () => {
      emitSnapshot?.([{ id: "p1", data: { name: "Site A", items: [], updatedAt: 1 } }])
    })

    expect(get().projects.map((p) => p.id)).not.toContain("p1")
    expect(uploaded, "a deleted project must never be uploaded again").not.toContain("p1")
    expect(storedIds()).toEqual([])
  })
})
