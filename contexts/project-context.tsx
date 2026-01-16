"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
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

// Types for project items
export interface ProjectItem {
  id: string
  type:
    | "subnet"
    | "vlsm"
    | "vlan"
    | "acl"
    | "dns"
    | "route"
    | "routing"
    | "mtu"
    | "ipv6"
    | "conflict"
    | "oui"
    | "port-scan"
    | "wireless"
    | "other"
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
  deleteProject: (id: string) => Promise<void>
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

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

// Generate unique ID
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [sharedProjects, setSharedProjects] = useState<SharedProject[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const syncEnabled = !!(user && isFirebaseConfigured() && db)

  // Load projects from localStorage on initial mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setProjects(Array.isArray(parsed) ? parsed : [])
      }
    } catch (error) {
      console.error("Failed to load projects from localStorage:", error)
    }
    setLoading(false)
  }, [])

  // Save to localStorage whenever projects change (and not syncing from cloud)
  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
      } catch (error) {
        console.error("Failed to save projects to localStorage:", error)
      }
    }
  }, [projects, loading])

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

        // Find local-only projects to upload
        const localOnlyProjects = projects.filter((p) => !cloudProjectIds.has(p.id))

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
            }
          })
        }

        // Merge: cloud projects + local-only projects
        const mergedProjects = [...cloudProjects, ...localOnlyProjects].sort(
          (a, b) => b.updatedAt - a.updatedAt
        )

        setProjects(mergedProjects)
        setSyncing(false)
      },
      (error) => {
        console.error("Firestore sync error:", error)
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
        await setDoc(projectRef, {
          ...project,
          ownerId: project.ownerId || user.uid,
          ownerEmail: project.ownerEmail || user.email,
        })
      } catch (error) {
        console.error("Failed to save project to cloud:", error)
      }
    },
    [syncEnabled, user]
  )

  // Delete from Firestore
  const deleteFromCloud = useCallback(
    async (projectId: string) => {
      if (!syncEnabled || !db || !user) return

      try {
        const projectRef = doc(db, "users", user.uid, "projects", projectId)
        await deleteDoc(projectRef)
      } catch (error) {
        console.error("Failed to delete project from cloud:", error)
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

  const updateProject = async (id: string, updates: Partial<Project>) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, ...updates, updatedAt: Date.now() }
          saveToCloud(updated)
          return updated
        }
        return p
      })
    )
  }

  const deleteProject = async (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id))
    await deleteFromCloud(id)
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

    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          const updated = {
            ...p,
            items: [...p.items, newItem],
            updatedAt: Date.now(),
          }
          saveToCloud(updated)
          return updated
        }
        return p
      })
    )
  }

  const removeItemFromProject = async (projectId: string, itemId: string) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          const updated = {
            ...p,
            items: p.items.filter((item) => item.id !== itemId),
            updatedAt: Date.now(),
          }
          saveToCloud(updated)
          return updated
        }
        return p
      })
    )
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
    try {
      const data = JSON.parse(jsonString)
      let importedProjects: Project[] = []

      if (Array.isArray(data)) {
        importedProjects = data
      } else if (data.projects && Array.isArray(data.projects)) {
        importedProjects = data.projects
      } else if (data.id && data.name) {
        importedProjects = [data]
      }

      // Assign new IDs to avoid conflicts
      const now = Date.now()
      const processedProjects = importedProjects.map((p) => ({
        ...p,
        id: generateId(),
        createdAt: p.createdAt || now,
        updatedAt: now,
        ownerId: user?.uid,
        ownerEmail: user?.email || undefined,
      }))

      setProjects((prev) => [...processedProjects, ...prev])

      // Upload to cloud if enabled
      for (const project of processedProjects) {
        await saveToCloud(project)
      }

      return processedProjects.length
    } catch (error) {
      console.error("Failed to import projects:", error)
      throw new Error("Invalid project data format")
    }
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
