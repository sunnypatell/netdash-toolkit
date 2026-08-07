"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react"
import { ensureFirestore, isFirebaseConfigured } from "@/lib/firebase"
import { useAuth } from "./auth-context"
import type { ShareEntry, ProjectShare, Permission } from "@/types/sharing"
import type { ProjectItemType } from "@/lib/tool-registry"
import { toast } from "sonner"

// biggest chunk in the app, so it loads only when a session reaches the cloud. the promise
// is cached because three effects open the cloud at once on sign-in.
let firestoreApi: Promise<typeof import("firebase/firestore")> | null = null

async function openCloud() {
  firestoreApi ??= import("firebase/firestore")
  const [firestore, api] = await Promise.all([ensureFirestore(), firestoreApi])
  return firestore ? { firestore, api } : null
}

export interface ProjectItem {
  id: string
  // owned by the registry; this was a second hand-maintained copy of the same 23 members
  type: ProjectItemType
  name: string
  data: Record<string, unknown>
  createdAt: number
  notes?: string
  toolSource?: string
}

export interface Project {
  id: string
  name: string
  description: string
  items: ProjectItem[]
  createdAt: number
  updatedAt: number
  tags: string[]
  ownerId?: string
  ownerEmail?: string
  sharedWith?: Record<string, ShareEntry>
  isShared?: boolean
}

export interface SharedProject extends Project {
  permission: Permission
  projectPath: string
  ownerEmail: string
}

interface ProjectContextType {
  projects: Project[]
  sharedProjects: SharedProject[]
  loading: boolean
  syncing: boolean
  syncEnabled: boolean
  addProject: (project: Omit<Project, "id" | "createdAt" | "updatedAt">) => Promise<Project>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<{ success: boolean; error?: string }>
  addItemToProject: (
    projectId: string,
    item: Omit<ProjectItem, "id" | "createdAt">
  ) => Promise<void>
  removeItemFromProject: (projectId: string, itemId: string) => Promise<void>
  getProjectById: (id: string) => Project | undefined
  exportProject: (project: Project) => void
  exportAllProjects: () => void
  importProjects: (jsonString: string) => Promise<number>
  isProjectOwner: (project: Project) => boolean
  canEditProject: (project: Project | SharedProject) => boolean
  getSharedProjectById: (id: string) => SharedProject | undefined
  updateSharedProject: (projectPath: string, updates: Partial<Project>) => Promise<void>
  addItemToSharedProject: (
    projectPath: string,
    item: Omit<ProjectItem, "id" | "createdAt">
  ) => Promise<void>
  removeItemFromSharedProject: (projectPath: string, itemId: string) => Promise<void>
}

const STORAGE_KEY = "netdash-projects"
// deleted ids, persisted: an in-memory guard died on refresh and the next snapshot re-uploaded them
const TOMBSTONE_KEY = "netdash-deleted-projects"
// a browser that deletes but never signs in gets no snapshot to retire these
const TOMBSTONE_LIMIT = 200

// id -> uid whose cloud copy still has to go, null when deleted signed out. only that account's
// snapshot may retire it; a second account's never carries the doc, which let the first restore it.
type Tombstones = Map<string, string | null>

function readTombstones(): Tombstones {
  const out: Tombstones = new Map()
  try {
    const raw = localStorage.getItem(TOMBSTONE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return out
    for (const entry of parsed) {
      // bare strings are the pre-uid format written by an older build
      if (typeof entry === "string") out.set(entry, null)
      else if (Array.isArray(entry) && typeof entry[0] === "string") {
        out.set(entry[0], typeof entry[1] === "string" ? entry[1] : null)
      }
    }
  } catch {
    return new Map()
  }
  return out
}

// re-reads storage rather than trusting this tab's copy, so a concurrent tab's tombstone survives
function updateTombstones(mutate: (ids: Tombstones) => void): Tombstones {
  const ids = readTombstones()
  mutate(ids)
  const capped: Tombstones = new Map([...ids].slice(-TOMBSTONE_LIMIT))
  try {
    localStorage.setItem(TOMBSTONE_KEY, JSON.stringify([...capped]))
  } catch {
    // a full or blocked localStorage must not break deletion
  }
  return capped
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

// the minimum an imported entry must carry to render as a project at all
function isImportableProject(
  value: unknown
): value is Record<string, unknown> & { name: string; items: unknown[] } {
  return isRecord(value) && typeof value.name === "string" && Array.isArray(value.items)
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  // authLoading separates "signed out" from "not known yet"; only the latter may refuse a delete
  const { user, loading: authLoading } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [sharedProjects, setSharedProjects] = useState<SharedProject[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  // not gated on `db`: firestore loads on demand, so requiring an instance here would prevent it
  const syncEnabled = !!(user && isFirebaseConfigured())

  // seeded from storage so a delete survives reload while the cloud copy is still going
  const deletingIdsRef = useRef<Tombstones>(new Map())
  // deletes in flight, so the snapshot retry below never issues a second write
  const inFlightDeletesRef = useRef<Set<string>>(new Set())
  // the snapshot callback outlives its render, so projects must be read through a ref
  const localProjectsRef = useRef<Project[]>([])
  // ids the current account's cloud snapshot supplied, and the uid it came from
  const cloudIdsRef = useRef<Set<string>>(new Set())
  const syncedUidRef = useRef<string | null>(null)

  useEffect(() => {
    try {
      deletingIdsRef.current = readTombstones()
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        const list: Project[] = Array.isArray(parsed) ? parsed : []
        // a tombstoned project must never come back, whatever storage still holds
        setProjects(list.filter((p) => !deletingIdsRef.current.has(p.id)))
      }
    } catch (error) {
      console.error("Failed to load projects from localStorage:", error)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    localProjectsRef.current = projects
    if (!loading) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
      } catch (error) {
        console.error("Failed to save projects to localStorage:", error)
      }
    }
  }, [projects, loading])

  // drops the previous account's projects on user change: they would look local-only to the next
  // account and be re-uploaded under its uid. must be declared before the sync effect below.
  useEffect(() => {
    const uid = user?.uid ?? null
    if (syncedUidRef.current === uid) return
    const previousUid = syncedUidRef.current
    syncedUidRef.current = uid
    // first sign-in on this device: local work is meant to merge into the cloud
    if (previousUid === null) return

    const stale = cloudIdsRef.current
    cloudIdsRef.current = new Set()
    if (stale.size === 0) return
    localProjectsRef.current = localProjectsRef.current.filter((p) => !stale.has(p.id))
    setProjects((prev) => prev.filter((p) => !stale.has(p.id)))
  }, [user])

  useEffect(() => {
    if (!syncEnabled || !user) return

    const updateUserData = async () => {
      try {
        const cloud = await openCloud()
        if (!cloud) return
        const { firestore, api } = cloud
        const { doc, setDoc } = api
        const { updateUserIndex } = await import("@/lib/sharing")

        // every signed-in user can read this doc, so it holds only what a collaborator chip renders
        const userRef = doc(firestore, "users", user.uid)
        await setDoc(
          userRef,
          {
            email: user.email,
            displayName: user.displayName || null,
            photoURL: user.photoURL || null,
          },
          { merge: true }
        )

        if (user.email) {
          await updateUserIndex(user.uid, user.email, user.displayName, user.photoURL)
        }
      } catch (error) {
        console.error("Failed to update user data:", error)
      }
    }

    updateUserData()
  }, [user, syncEnabled])

  useEffect(() => {
    if (!syncEnabled || !user) {
      return
    }

    setSyncing(true)
    let cancelled = false
    let unsubscribe: (() => void) | null = null

    const subscribe = async () => {
      const cloud = await openCloud()
      if (cancelled || !cloud) {
        if (!cancelled) setSyncing(false)
        return
      }
      const { firestore, api } = cloud
      const { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc } = api

      const projectsRef = collection(firestore, "users", user.uid, "projects")
      const q = query(projectsRef, orderBy("updatedAt", "desc"))

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const cloudProjects: Project[] = []
          snapshot.forEach((docSnap) => {
            cloudProjects.push({ id: docSnap.id, ...docSnap.data() } as Project)
          })

          const cloudProjectIds = new Set(cloudProjects.map((p) => p.id))
          cloudIdsRef.current = cloudProjectIds

          // another tab may have deleted since this one mounted, and its tombstone is only on disk
          const tombstoned: Tombstones = new Map([...deletingIdsRef.current, ...readTombstones()])
          deletingIdsRef.current = tombstoned

          // a deleted project is never local-only: uploading it is how a delete used to undo itself
          const localOnlyProjects = localProjectsRef.current.filter(
            (p) => !cloudProjectIds.has(p.id) && !tombstoned.has(p.id)
          )

          // a signed-out delete carries no uid, so the first account to sync claims it
          const ours = (uid: string | null) => uid === null || uid === user.uid

          // gone from the cloud, so the delete is confirmed and the tombstone can be retired
          const confirmed = [...tombstoned]
            .filter(([id, uid]) => ours(uid) && !cloudProjectIds.has(id))
            .map(([id]) => id)
          if (confirmed.length > 0) {
            deletingIdsRef.current = updateTombstones((ids) => {
              for (const id of confirmed) ids.delete(id)
            })
          }

          // still in the cloud means the delete never landed; retry rather than hide it forever
          const pending = [...deletingIdsRef.current]
            .filter(([id, uid]) => ours(uid) && cloudProjectIds.has(id))
            .map(([id]) => id)
          for (const id of pending) {
            // a long offline spell delivers many stale snapshots, each queueing another write
            if (inFlightDeletesRef.current.has(id)) continue
            inFlightDeletesRef.current.add(id)
            deleteDoc(doc(firestore, "users", user.uid, "projects", id))
              .catch((error: unknown) => {
                console.error("Failed to delete project from cloud:", error)
                // the copy survived, so stop hiding it and let the user retry
                deletingIdsRef.current = updateTombstones((ids) => ids.delete(id))
                const survivor = cloudProjects.find((p) => p.id === id)
                if (survivor) {
                  setProjects((prev) =>
                    prev.some((p) => p.id === id) ? prev : [survivor, ...prev]
                  )
                }
                toast.error("Could not delete a project from the cloud", {
                  description:
                    error instanceof Error ? error.message : "It is still saved in your account.",
                })
              })
              .finally(() => inFlightDeletesRef.current.delete(id))
          }

          if (localOnlyProjects.length > 0 && user.email) {
            localOnlyProjects.forEach(async (project) => {
              try {
                const projectRef = doc(firestore, "users", user.uid, "projects", project.id)
                await setDoc(projectRef, {
                  ...project,
                  ownerId: user.uid,
                  ownerEmail: user.email,
                })
              } catch (error) {
                console.error("Failed to upload local project to cloud:", error)
                toast.error(`Could not upload "${project.name}" to the cloud`)
              }
            })
          }

          const mergedProjects = [...cloudProjects, ...localOnlyProjects]
            .filter((p) => !deletingIdsRef.current.has(p.id))
            .filter((p, i, all) => all.findIndex((o) => o.id === p.id) === i)
            .sort((a, b) => b.updatedAt - a.updatedAt)

          setProjects(mergedProjects)
          setSyncing(false)
        },
        (error) => {
          // console-only before: the ui showed stale local data with no hint that sync was dead
          console.error("Firestore sync error:", error)
          toast.error("Cloud sync stopped", { description: error.message })
          setSyncing(false)
        }
      )
    }

    subscribe()

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [user, syncEnabled])

  useEffect(() => {
    if (!syncEnabled || !user) {
      setSharedProjects([])
      return
    }

    let cancelled = false
    let unsubscribe: (() => void) | null = null

    const subscribe = async () => {
      const cloud = await openCloud()
      if (cancelled || !cloud) return
      const { firestore, api } = cloud
      const { doc, getDoc } = api
      const { subscribeToSharedProjects } = await import("@/lib/sharing")
      if (cancelled) return

      unsubscribe = subscribeToSharedProjects(user.uid, async (shares: ProjectShare[]) => {
        const loadedProjects: SharedProject[] = []

        for (const share of shares) {
          try {
            const projectRef = doc(firestore, share.projectPath)
            const projectSnap = await getDoc(projectRef)

            if (projectSnap.exists()) {
              const projectData = projectSnap.data() as Project
              loadedProjects.push({
                ...projectData,
                id: projectSnap.id,
                permission: share.permission,
                projectPath: share.projectPath,
                ownerEmail: share.ownerEmail,
              })
            }
          } catch (error) {
            console.error(`Failed to load shared project ${share.projectId}:`, error)
          }
        }

        setSharedProjects(loadedProjects.sort((a, b) => b.updatedAt - a.updatedAt))
      })
    }

    subscribe()

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [user, syncEnabled])

  // Save project to Firestore
  const saveToCloud = useCallback(
    async (project: Project) => {
      if (!syncEnabled || !user) return

      try {
        const cloud = await openCloud()
        if (!cloud) return
        const { doc, setDoc } = cloud.api

        const projectRef = doc(cloud.firestore, "users", user.uid, "projects", project.id)
        // merge: a full overwrite drops sharedWith/isShared when the local copy never loaded them
        await setDoc(
          projectRef,
          {
            ...project,
            ownerId: project.ownerId || user.uid,
            ownerEmail: project.ownerEmail || user.email,
          },
          { merge: true }
        )
      } catch (error) {
        // console-only before: a rejected write looked like a successful save
        console.error("Failed to save project to cloud:", error)
        toast.error("Could not sync project to the cloud", {
          description: error instanceof Error ? error.message : "Your local copy is still saved.",
        })
      }
    },
    [syncEnabled, user]
  )

  const deleteFromCloud = useCallback(
    async (projectId: string): Promise<boolean> => {
      // "no user" is not "no cloud": returning true with auth unresolved deleted locally and let
      // the next snapshot restore the cloud copy, which is the resurrection users hit.
      if (!isFirebaseConfigured()) return true
      if (!user) {
        // only the unresolved case is dangerous; refusing when genuinely signed out would
        // leave a visitor unable to delete their own local work
        if (authLoading) {
          throw new Error("Still signing in, so the cloud copy could not be deleted. Try again.")
        }
        // the tombstone survives, so the first snapshot after sign-in removes it
        return true
      }
      if (!syncEnabled) return true

      try {
        const cloud = await openCloud()
        if (!cloud) return true
        const { doc, deleteDoc } = cloud.api

        const projectRef = doc(cloud.firestore, "users", user.uid, "projects", projectId)
        await deleteDoc(projectRef)

        // shares live in a separate top-level collection, so collaborators would still see it
        try {
          const { deleteAllSharesForProject } = await import("@/lib/sharing")
          await deleteAllSharesForProject(user.uid, projectId)
        } catch (error) {
          // the project is already gone, so a failed cleanup must not fail the delete
          console.error("Failed to clean up share records:", error)
        }
        return true
      } catch (error) {
        console.error("Failed to delete project from cloud:", error)
        throw error
      }
    },
    [syncEnabled, user, authLoading]
  )

  const addProject = async (
    projectData: Omit<Project, "id" | "createdAt" | "updatedAt">
  ): Promise<Project> => {
    const now = Date.now()
    const newProject: Project = {
      ...projectData,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      ownerId: user?.uid,
      ownerEmail: user?.email || undefined,
    }

    setProjects((prev) => [newProject, ...prev])
    await saveToCloud(newProject)

    return newProject
  }

  // the cloud write sits outside the setProjects updater; inside it was unawaited and the
  // caller toasted "saved" before the write was sent
  const updateProject = async (id: string, updates: Partial<Project>) => {
    let updated: Project | undefined
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        updated = { ...p, ...updates, updatedAt: Date.now() }
        return updated
      })
    )
    if (updated) await saveToCloud(updated)
  }

  const deleteProject = async (id: string): Promise<{ success: boolean; error?: string }> => {
    // written before the request, so a reload mid-delete still cannot resurrect it
    deletingIdsRef.current = updateTombstones((ids) => ids.set(id, user?.uid ?? null))

    try {
      inFlightDeletesRef.current.add(id)
      try {
        await deleteFromCloud(id)
      } finally {
        inFlightDeletesRef.current.delete(id)
      }

      // the ref must be pruned in this tick: setProjects has not committed, so a snapshot
      // arriving first would still see the project, call it local-only and re-upload it
      localProjectsRef.current = localProjectsRef.current.filter((p) => p.id !== id)
      cloudIdsRef.current.delete(id)
      setProjects((prev) => prev.filter((p) => p.id !== id))

      // normally the confirming snapshot retires the tombstone; with no cloud none ever arrives
      if (!isFirebaseConfigured()) {
        deletingIdsRef.current = updateTombstones((ids) => ids.delete(id))
      }

      return { success: true }
    } catch (error) {
      console.error("Delete project failed:", error)

      // the cloud copy survived, so keeping the tombstone would hide a project that still exists
      deletingIdsRef.current = updateTombstones((ids) => ids.delete(id))

      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete project from cloud",
      }
    }
  }

  const addItemToProject = async (
    projectId: string,
    item: Omit<ProjectItem, "id" | "createdAt">
  ) => {
    const newItem: ProjectItem = {
      ...item,
      id: generateId(),
      createdAt: Date.now(),
    }

    let updated: Project | undefined
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p
        updated = { ...p, items: [...p.items, newItem], updatedAt: Date.now() }
        return updated
      })
    )
    if (updated) await saveToCloud(updated)
  }

  const removeItemFromProject = async (projectId: string, itemId: string) => {
    let updated: Project | undefined
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p
        updated = {
          ...p,
          items: p.items.filter((item) => item.id !== itemId),
          updatedAt: Date.now(),
        }
        return updated
      })
    )
    if (updated) await saveToCloud(updated)
  }

  const getProjectById = (id: string) => {
    return projects.find((p) => p.id === id)
  }

  const getSharedProjectById = (id: string) => {
    return sharedProjects.find((p) => p.id === id)
  }

  const isProjectOwner = (project: Project): boolean => {
    if (!user) return false
    // projects predating sharing have no ownerId, so a missing one means locally owned
    return !project.ownerId || project.ownerId === user.uid
  }

  const canEditProject = (project: Project | SharedProject): boolean => {
    if (!user) return false

    if (!project.ownerId || project.ownerId === user.uid) {
      return true
    }

    if ("permission" in project) {
      return project.permission === "edit" || project.permission === "admin"
    }

    if (project.sharedWith && project.sharedWith[user.uid]) {
      const permission = project.sharedWith[user.uid].permission
      return permission === "edit" || permission === "admin"
    }

    return false
  }

  const updateSharedProject = async (projectPath: string, updates: Partial<Project>) => {
    const cloud = await openCloud()
    if (!cloud) return
    const { doc, setDoc } = cloud.api

    try {
      const projectRef = doc(cloud.firestore, projectPath)
      await setDoc(
        projectRef,
        {
          ...updates,
          updatedAt: Date.now(),
        },
        { merge: true }
      )

      setSharedProjects((prev) =>
        prev.map((p) => {
          if (p.projectPath === projectPath) {
            return { ...p, ...updates, updatedAt: Date.now() }
          }
          return p
        })
      )
    } catch (error) {
      console.error("Failed to update shared project:", error)
      throw error
    }
  }

  const addItemToSharedProject = async (
    projectPath: string,
    item: Omit<ProjectItem, "id" | "createdAt">
  ) => {
    const project = sharedProjects.find((p) => p.projectPath === projectPath)
    if (!project) return

    const cloud = await openCloud()
    if (!cloud) return
    const { doc, setDoc } = cloud.api

    const newItem: ProjectItem = {
      ...item,
      id: generateId(),
      createdAt: Date.now(),
    }

    try {
      const projectRef = doc(cloud.firestore, projectPath)
      await setDoc(
        projectRef,
        {
          items: [...project.items, newItem],
          updatedAt: Date.now(),
        },
        { merge: true }
      )

      setSharedProjects((prev) =>
        prev.map((p) => {
          if (p.projectPath === projectPath) {
            return {
              ...p,
              items: [...p.items, newItem],
              updatedAt: Date.now(),
            }
          }
          return p
        })
      )
    } catch (error) {
      console.error("Failed to add item to shared project:", error)
      throw error
    }
  }

  const removeItemFromSharedProject = async (projectPath: string, itemId: string) => {
    const project = sharedProjects.find((p) => p.projectPath === projectPath)
    if (!project) return

    const cloud = await openCloud()
    if (!cloud) return
    const { doc, setDoc } = cloud.api

    try {
      const projectRef = doc(cloud.firestore, projectPath)
      await setDoc(
        projectRef,
        {
          items: project.items.filter((item) => item.id !== itemId),
          updatedAt: Date.now(),
        },
        { merge: true }
      )

      setSharedProjects((prev) =>
        prev.map((p) => {
          if (p.projectPath === projectPath) {
            return {
              ...p,
              items: p.items.filter((item) => item.id !== itemId),
              updatedAt: Date.now(),
            }
          }
          return p
        })
      )
    } catch (error) {
      console.error("Failed to remove item from shared project:", error)
      throw error
    }
  }

  const exportProject = (project: Project) => {
    const dataStr = JSON.stringify(project, null, 2)
    const blob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${project.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-project.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const exportAllProjects = () => {
    const dataStr = JSON.stringify({ projects, exportedAt: Date.now() }, null, 2)
    const blob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `netdash-all-projects-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const importProjects = async (jsonString: string): Promise<number> => {
    let data: unknown
    try {
      data = JSON.parse(jsonString)
    } catch (error) {
      console.error("Failed to parse imported projects:", error)
      throw new Error("Invalid project data format")
    }

    let candidates: unknown[] = []
    if (Array.isArray(data)) {
      candidates = data
    } else if (isRecord(data) && Array.isArray(data.projects)) {
      candidates = data.projects
    } else if (isRecord(data)) {
      candidates = [data]
    }

    // every field is re-derived: an unrelated json file used to import "successfully" and leave
    // projects with no items/tags array, crashing the list and syncing that state to firestore
    const now = Date.now()
    const processedProjects = candidates.filter(isImportableProject).map((p) => ({
      ...p,
      name: p.name,
      description: typeof p.description === "string" ? p.description : "",
      tags: Array.isArray(p.tags) ? p.tags.filter((t): t is string => typeof t === "string") : [],
      items: p.items.filter(isRecord).map((item) => ({
        ...item,
        id: typeof item.id === "string" ? item.id : generateId(),
        type: (typeof item.type === "string" ? item.type : "other") as ProjectItemType,
        name: typeof item.name === "string" ? item.name : "Untitled item",
        data: isRecord(item.data) ? item.data : {},
        createdAt: typeof item.createdAt === "number" ? item.createdAt : now,
      })),
      id: generateId(),
      createdAt: typeof p.createdAt === "number" ? p.createdAt : now,
      updatedAt: now,
      ownerId: user?.uid,
      ownerEmail: user?.email || undefined,
    }))

    if (processedProjects.length === 0) {
      throw new Error("No projects found in this file")
    }

    setProjects((prev) => [...processedProjects, ...prev])

    for (const project of processedProjects) {
      await saveToCloud(project)
    }

    return processedProjects.length
  }

  return (
    <ProjectContext.Provider
      value={{
        projects,
        sharedProjects,
        loading,
        syncing,
        syncEnabled,
        addProject,
        updateProject,
        deleteProject,
        addItemToProject,
        removeItemFromProject,
        getProjectById,
        exportProject,
        exportAllProjects,
        importProjects,
        isProjectOwner,
        canEditProject,
        getSharedProjectById,
        updateSharedProject,
        addItemToSharedProject,
        removeItemFromSharedProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  )
}

export function useProjects() {
  const context = useContext(ProjectContext)
  if (context === undefined) {
    throw new Error("useProjects must be used within a ProjectProvider")
  }
  return context
}
