import {
  collection,
  doc,
  setDoc,
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

// strips the characters firestore rejects in a document id
function normalizeEmail(email: string): string {
  return email.toLowerCase().replace(/[.#$[\]\/]/g, "_")
}

// called on login; the index is what makes a user findable by email
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

  // flat mirror of the share: "shared with me" cannot be a query across every owner's projects subcollection
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

export async function unshareProject(
  ownerId: string,
  projectId: string,
  targetUserId: string
): Promise<void> {
  if (!db) return

  const batch = writeBatch(db)

  const projectRef = doc(db, "users", ownerId, "projects", projectId)
  batch.update(projectRef, {
    [`sharedWith.${targetUserId}`]: deleteField(),
    updatedAt: Date.now(),
  })

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

// on project delete; without it collaborators keep seeing a project that is gone
export async function deleteAllSharesForProject(ownerId: string, projectId: string): Promise<void> {
  if (!db) return

  const sharesQuery = query(
    collection(db, "projectShares"),
    where("ownerId", "==", ownerId),
    where("projectId", "==", projectId)
  )
  const snapshots = await getDocs(sharesQuery)
  if (snapshots.empty) return

  const batch = writeBatch(db)
  snapshots.forEach((docSnap) => batch.delete(docSnap.ref))
  await batch.commit()
}

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

export async function updateSharePermission(
  ownerId: string,
  projectId: string,
  targetUserId: string,
  newPermission: Permission
): Promise<void> {
  if (!db) return

  const batch = writeBatch(db)

  const projectRef = doc(db, "users", ownerId, "projects", projectId)
  batch.update(projectRef, {
    [`sharedWith.${targetUserId}.permission`]: newPermission,
    updatedAt: Date.now(),
  })

  // the mirror carries its own copy of permission, so both writes are required
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
