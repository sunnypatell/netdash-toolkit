import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  getDoc,
  onSnapshot,
  writeBatch,
  deleteField,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Permission, ProjectShare, UserIndexEntry } from "@/types/sharing"

/**
 * Normalize email for use as document ID
 * Replaces characters not allowed in Firestore document IDs
 */
function normalizeEmail(email: string): string {
  return email.toLowerCase().replace(/[.#$[\]\/]/g, "_")
}

/**
 * Create or update user index entry
 * Called on login to make user searchable by email
 */
export async function updateUserIndex(
  uid: string,
  email: string,
  displayName: string | null,
  photoURL: string | null
): Promise<void> {
  if (!db) return

  const normalizedEmail = normalizeEmail(email)
  const indexRef = doc(db, "userIndex", normalizedEmail)

  await setDoc(
    indexRef,
    {
      email,
      uid,
      displayName,
      photoURL,
      createdAt: Date.now(),
    },
    { merge: true }
  )
}

/**
 * Look up user by email address
 * Returns null if user not found or not registered
 */
export async function findUserByEmail(email: string): Promise<UserIndexEntry | null> {
  if (!db) return null

  const normalizedEmail = normalizeEmail(email)
  const indexRef = doc(db, "userIndex", normalizedEmail)
  const snapshot = await getDoc(indexRef)

  if (snapshot.exists()) {
    return snapshot.data() as UserIndexEntry
  }
  return null
}

/**
 * Share a project with another user
 * Creates both the sharedWith entry on the project and a projectShares document
 */
export async function shareProject(
  ownerId: string,
  ownerEmail: string,
  projectId: string,
  projectName: string,
  targetUserId: string,
  targetEmail: string,
  permission: Permission
): Promise<void> {
  if (!db) return

  const batch = writeBatch(db)

  // Update project's sharedWith map
  const projectRef = doc(db, "users", ownerId, "projects", projectId)
  batch.update(projectRef, {
    [`sharedWith.${targetUserId}`]: {
      email: targetEmail,
      permission,
      addedAt: Date.now(),
      addedBy: ownerId,
    },
    isShared: true,
    updatedAt: Date.now(),
  })

  // Create projectShare document for recipient's query
  const shareRef = doc(collection(db, "projectShares"))
  batch.set(shareRef, {
    id: shareRef.id,
    projectId,
    projectPath: `users/${ownerId}/projects/${projectId}`,
    ownerId,
    ownerEmail,
    sharedWithUserId: targetUserId,
    sharedWithEmail: targetEmail,
    permission,
    projectName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })

  await batch.commit()
}

/**
 * Remove a user's access to a shared project
 */
export async function unshareProject(
  ownerId: string,
  projectId: string,
  targetUserId: string
): Promise<void> {
  if (!db) return

  const batch = writeBatch(db)

  // Remove from project's sharedWith map
  const projectRef = doc(db, "users", ownerId, "projects", projectId)
  batch.update(projectRef, {
    [`sharedWith.${targetUserId}`]: deleteField(),
    updatedAt: Date.now(),
  })

  // Find and delete the projectShare document
  const sharesQuery = query(
    collection(db, "projectShares"),
    where("projectId", "==", projectId),
    where("sharedWithUserId", "==", targetUserId)
  )
  const snapshots = await getDocs(sharesQuery)
  snapshots.forEach((docSnap) => {
    batch.delete(docSnap.ref)
  })

  await batch.commit()
}

/**
 * Subscribe to projects shared with the current user
 * Returns an unsubscribe function
 */
export function subscribeToSharedProjects(
  userId: string,
  callback: (shares: ProjectShare[]) => void
): () => void {
  if (!db) return () => {}

  const sharesQuery = query(
    collection(db, "projectShares"),
    where("sharedWithUserId", "==", userId)
  )

  return onSnapshot(sharesQuery, (snapshot) => {
    const shares: ProjectShare[] = []
    snapshot.forEach((docSnap) => {
      shares.push(docSnap.data() as ProjectShare)
    })
    callback(shares)
  })
}

/**
 * Update permission level for a shared user
 */
export async function updateSharePermission(
  ownerId: string,
  projectId: string,
  targetUserId: string,
  newPermission: Permission
): Promise<void> {
  if (!db) return

  const batch = writeBatch(db)

  // Update project's sharedWith map
  const projectRef = doc(db, "users", ownerId, "projects", projectId)
  batch.update(projectRef, {
    [`sharedWith.${targetUserId}.permission`]: newPermission,
    updatedAt: Date.now(),
  })

  // Update projectShare document
  const sharesQuery = query(
    collection(db, "projectShares"),
    where("projectId", "==", projectId),
    where("sharedWithUserId", "==", targetUserId)
  )
  const snapshots = await getDocs(sharesQuery)
  snapshots.forEach((docSnap) => {
    batch.update(docSnap.ref, {
      permission: newPermission,
      updatedAt: Date.now(),
    })
  })

  await batch.commit()
}

/**
 * Get a shared project by its path
 * Used to load the full project data when viewing a shared project
 */
export async function getSharedProject(
  projectPath: string
): Promise<Record<string, unknown> | null> {
  if (!db) return null

  const projectRef = doc(db, projectPath)
  const snapshot = await getDoc(projectRef)

  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() }
  }
  return null
}

/**
 * Subscribe to a shared project for real-time updates
 */
export function subscribeToSharedProject(
  projectPath: string,
  callback: (project: Record<string, unknown> | null) => void
): () => void {
  if (!db) return () => {}

  const projectRef = doc(db, projectPath)

  return onSnapshot(projectRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() })
    } else {
      callback(null)
    }
  })
}

/**
 * Check if the current sharedWith map is empty and update isShared flag
 */
export async function updateIsSharedFlag(ownerId: string, projectId: string): Promise<void> {
  if (!db) return

  const projectRef = doc(db, "users", ownerId, "projects", projectId)
  const snapshot = await getDoc(projectRef)

  if (snapshot.exists()) {
    const data = snapshot.data()
    const sharedWith = data.sharedWith || {}
    const hasShares = Object.keys(sharedWith).length > 0

    if (data.isShared !== hasShares) {
      await setDoc(projectRef, { isShared: hasShares }, { merge: true })
    }
  }
}
