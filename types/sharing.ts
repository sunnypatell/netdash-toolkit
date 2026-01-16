export type Permission = "view" | "edit" | "admin"

export interface ShareEntry {
  email: string
  permission: Permission
  addedAt: number
  addedBy: string
}

export interface ProjectShare {
  id: string
  projectId: string
  projectPath: string
  ownerId: string
  ownerEmail: string
  sharedWithUserId: string
  sharedWithEmail: string
  permission: Permission
  projectName: string
  createdAt: number
  updatedAt: number
}

export interface UserIndexEntry {
  email: string
  uid: string
  displayName: string | null
  photoURL: string | null
  createdAt: number
}

export interface SharedProjectInfo {
  projectId: string
  projectPath: string
  projectName: string
  ownerEmail: string
  ownerId: string
  permission: Permission
}
