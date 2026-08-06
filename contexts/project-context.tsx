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
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  getDoc,
} from "firebase/firestore"
import { db, isFirebaseConfigured } from "@/lib/firebase"
import { useAuth } from "./auth-context"
import { updateUserIndex, subscribeToSharedProjects } from "@/lib/sharing"
import type { ShareEntry, ProjectShare, Permission } from "@/types/sharing"
import type { ProjectItemType } from "@/lib/tool-registry"
import { toast } from "sonner"

// Types for project items
export interface ProjectItem {
  id: string
  // one union, owned by the registry: this was a second hand-maintained copy
  // of the same 23 members, kept in sync by luck
  type: ProjectItemType
  name: string
  data: Record<string, unknown>
  createdAt: number
  notes?: string
  toolSource?: string // Which tool generated this item
}

export interface Project {
  id: string
  name: string
  description: string
  items: ProjectItem[]
  createdAt: number
  updatedAt: number
  tags: string[]
  // Sharing fields
  ownerId?: string
  ownerEmail?: string
  sharedWith?: Record<string, ShareEntry>
  isShared?: boolean
}

// Shared project with permission info
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
  // Sharing helpers
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
// ids the user deleted. persisted, because an in-flight snapshot that still
// carries a deleted project used to re-upload it to firestore, and a refresh
// then read it straight back. an in-memory guard cannot survive that refresh.
const TOMBSTONE_KEY = "netdash-deleted-projects"

function readTombstones(): Set<string> {
  try {
    const raw = localStorage.getItem(TOMBSTONE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return new Set(
      Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
    )
  } catch {
    return new Set()
  }
}

function writeTombstones(ids: Set<string>) {
  try {
    localStorage.setItem(TOMBSTONE_KEY, JSON.stringify([...ids]))
  } catch {
    // a full or blocked localStorage must not break deletion
  }
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

// Generate unique ID
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
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [sharedProjects, setSharedProjects] = useState<SharedProject[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const syncEnabled = !!(user && isFirebaseConfigured() && db)

  // Track projects being deleted to prevent listener from restoring them.
  // seeded from storage so a delete survives a reload while the cloud copy is
  // still being removed.
  const deletingIdsRef = useRef<Set<string>>(new Set())
  // the snapshot callback below outlives the render that created it, so it
  // must read projects through a ref rather than the captured array
  const localProjectsRef = useRef<Project[]>([])
  // ids the current account's cloud snapshot supplied, and the uid it came from
  const cloudIdsRef = useRef<Set<string>>(new Set())
  const syncedUidRef = useRef<string | null>(null)

  // Load projects from localStorage on initial mount
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

  // Save to localStorage whenever projects change (and not syncing from cloud)
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

  // Drop the previous account's cloud projects when the signed-in user changes.
  // without this they stay in state, look local-only to the next account's
  // snapshot, and get re-uploaded into that account with its uid as ownerId.
  // must run before the sync effect below, so it is declared first.
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

  // Update user profile and user index for sharing
  useEffect(() => {
    if (!syncEnabled || !db || !user) return

    const firestore = db // Capture non-null reference
    const updateUserData = async () => {
      try {
        // Update user profile document
        const userRef = doc(firestore, "users", user.uid)
        await setDoc(
          userRef,
          {
            email: user.email,
            displayName: user.displayName || null,
            photoURL: user.photoURL || null,
            lastSeen: Date.now(),
            provider: user.providerData[0]?.providerId || "unknown",
          },
          { merge: true }
        )

        // Update user index for email-based search
        if (user.email) {
          await updateUserIndex(user.uid, user.email, user.displayName, user.photoURL)
        }
      } catch (error) {
        console.error("Failed to update user data:", error)
      }
    }

    updateUserData()
  }, [user, syncEnabled])

  // Sync own projects with Firestore
  useEffect(() => {
    if (!syncEnabled || !db || !user) {
      return
    }

    const firestore = db // Capture non-null reference for callbacks
    setSyncing(true)

    const projectsRef = collection(firestore, "users", user.uid, "projects")
    const q = query(projectsRef, orderBy("updatedAt", "desc"))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const cloudProjects: Project[] = []
        snapshot.forEach((docSnap) => {
          cloudProjects.push({ id: docSnap.id, ...docSnap.data() } as Project)
        })

        // Merge cloud projects with local projects
        const cloudProjectIds = new Set(cloudProjects.map((p) => p.id))
        cloudIdsRef.current = cloudProjectIds

        // a deleted project is never local-only: uploading it is exactly how a
        // delete used to undo itself
        const tombstoned = deletingIdsRef.current
        const localOnlyProjects = localProjectsRef.current.filter(
          (p) => !cloudProjectIds.has(p.id) && !tombstoned.has(p.id)
        )

        // the cloud no longer has it, so the delete is confirmed and the
        // tombstone can be retired rather than growing without bound
        if (tombstoned.size > 0) {
          let changed = false
          for (const id of [...tombstoned]) {
            if (!cloudProjectIds.has(id)) {
              tombstoned.delete(id)
              changed = true
            }
          }
          if (changed) writeTombstones(tombstoned)
        }

        // Upload local-only projects to cloud with owner info
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

        // Merge: cloud projects + local-only projects
        // Filter out any projects that are currently being deleted
        const mergedProjects = [...cloudProjects, ...localOnlyProjects]
          .filter((p) => !deletingIdsRef.current.has(p.id))
          .filter((p, i, all) => all.findIndex((o) => o.id === p.id) === i)
          .sort((a, b) => b.updatedAt - a.updatedAt)

        setProjects(mergedProjects)
        setSyncing(false)
      },
      (error) => {
        // a rules rejection or offline client used to be console-only, so the
        // ui just showed stale local data with no hint that sync was dead
        console.error("Firestore sync error:", error)
        toast.error("Cloud sync stopped", { description: error.message })
        setSyncing(false)
      }
    )

    return () => unsubscribe()
  }, [user, syncEnabled])

  // Subscribe to projects shared with the current user
  useEffect(() => {
    if (!syncEnabled || !db || !user) {
      setSharedProjects([])
      return
    }

    const firestore = db
    const unsubscribe = subscribeToSharedProjects(user.uid, async (shares: ProjectShare[]) => {
      // Load full project data for each share
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

    return () => unsubscribe()
  }, [user, syncEnabled])

  // Save project to Firestore
  const saveToCloud = useCallback(
    async (project: Project) => {
      if (!syncEnabled || !db || !user) return

      try {
        const projectRef = doc(db, "users", user.uid, "projects", project.id)
        // merge so a save never wipes sharing state the local copy has not
        // loaded (sharedWith, isShared), which a full overwrite would drop
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
        // this used to be console-only, so a rejected write looked like a
        // successful save and the project simply never appeared on other devices
        console.error("Failed to save project to cloud:", error)
        toast.error("Could not sync project to the cloud", {
          description: error instanceof Error ? error.message : "Your local copy is still saved.",
        })
      }
    },
    [syncEnabled, user]
  )

  // Delete from Firestore
  const deleteFromCloud = useCallback(
    async (projectId: string): Promise<boolean> => {
      // "no user" is not the same as "no cloud". if firebase is configured, the
      // project may exist in firestore under an account whose auth has not
      // resolved yet, and reporting success here deletes it locally while
      // leaving the cloud copy to be restored by the next snapshot. that is the
      // resurrection the user actually saw.
      if (!isFirebaseConfigured() || !db) return true
      if (!user) {
        throw new Error("Not signed in yet, so the cloud copy could not be deleted. Try again.")
      }
      if (!syncEnabled) return true

      try {
        const projectRef = doc(db, "users", user.uid, "projects", projectId)
        await deleteDoc(projectRef)
        return true
      } catch (error) {
        console.error("Failed to delete project from cloud:", error)
        throw error // Propagate error so caller knows deletion failed
      }
    },
    [syncEnabled, user]
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

  // the cloud write used to be fired from inside the setProjects updater, so it
  // was unawaited and the caller toasted "saved" before it had even been sent.
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
    deletingIdsRef.current.add(id)
    writeTombstones(deletingIdsRef.current)

    try {
      // Delete from cloud first (wait for completion)
      await deleteFromCloud(id)

      // Then update local state. the ref has to be pruned in the same tick:
      // setProjects has not committed yet, so a snapshot arriving before the
      // next render would still see the project here, call it local-only and
      // upload it again.
      localProjectsRef.current = localProjectsRef.current.filter((p) => p.id !== id)
      cloudIdsRef.current.delete(id)
      setProjects((prev) => prev.filter((p) => p.id !== id))

      // the tombstone is retired by the snapshot that confirms the cloud copy is
      // gone, not here: clearing it now reopens the window an in-flight snapshot
      // used to walk through
      if (!syncEnabled) {
        deletingIdsRef.current.delete(id)
        writeTombstones(deletingIdsRef.current)
      }

      return { success: true }
    } catch (error) {
      // Keep the ID in deletingIdsRef to prevent restoration during retry
      // But allow future deletion attempts
      console.error("Delete project failed:", error)

      // the tombstone stays. dropping it on a timer was what let a failed delete
      // reappear, and it is retired only when the cloud confirms the copy is gone

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

  // Check if current user owns the project
  const isProjectOwner = (project: Project): boolean => {
    if (!user) return false
    // If no ownerId set, assume current user owns it (legacy projects)
    return !project.ownerId || project.ownerId === user.uid
  }

  // Check if current user can edit the project
  const canEditProject = (project: Project | SharedProject): boolean => {
    if (!user) return false

    // Owner can always edit
    if (!project.ownerId || project.ownerId === user.uid) {
      return true
    }

    // Check if it's a shared project with edit permission
    if ("permission" in project) {
      return project.permission === "edit" || project.permission === "admin"
    }

    // Check sharedWith map
    if (project.sharedWith && project.sharedWith[user.uid]) {
      const permission = project.sharedWith[user.uid].permission
      return permission === "edit" || permission === "admin"
    }

    return false
  }

  // Update a shared project
  const updateSharedProject = async (projectPath: string, updates: Partial<Project>) => {
    if (!db) return

    try {
      const projectRef = doc(db, projectPath)
      await setDoc(
        projectRef,
        {
          ...updates,
          updatedAt: Date.now(),
        },
        { merge: true }
      )

      // Update local state
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

  // Add item to a shared project
  const addItemToSharedProject = async (
    projectPath: string,
    item: Omit<ProjectItem, "id" | "createdAt">
  ) => {
    if (!db) return

    const project = sharedProjects.find((p) => p.projectPath === projectPath)
    if (!project) return

    const newItem: ProjectItem = {
      ...item,
      id: generateId(),
      createdAt: Date.now(),
    }

    try {
      const projectRef = doc(db, projectPath)
      await setDoc(
        projectRef,
        {
          items: [...project.items, newItem],
          updatedAt: Date.now(),
        },
        { merge: true }
      )

      // Update local state
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

  // Remove item from a shared project
  const removeItemFromSharedProject = async (projectPath: string, itemId: string) => {
    if (!db) return

    const project = sharedProjects.find((p) => p.projectPath === projectPath)
    if (!project) return

    try {
      const projectRef = doc(db, projectPath)
      await setDoc(
        projectRef,
        {
          items: project.items.filter((item) => item.id !== itemId),
          updatedAt: Date.now(),
        },
        { merge: true }
      )

      // Update local state
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

    // an unrelated json file used to import "successfully" and leave projects
    // with no items/tags array behind, which crashes the list on next render
    // and gets uploaded to firestore in that state
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

    // Upload to cloud if enabled
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
