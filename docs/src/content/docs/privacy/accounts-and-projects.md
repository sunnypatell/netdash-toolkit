---
title: Accounts and saved projects
description: How the optional Firebase account works in NetDash Toolkit, why the SDK is not on the critical path, exactly what Firestore stores, and why a deleted project is tombstoned in localStorage rather than trusted to a resolved delete.
---

Signing in is optional and buys exactly one thing: saved projects that sync across devices. Every one of the 48 tools works signed out, and 11 of them can save output once you are signed in.

## Firebase is optional, and the code proves it

[`lib/firebase.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/firebase.ts) gates everything on three environment variables:

```ts
export const isFirebaseConfigured = (): boolean => {
  return !!(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId)
}
```

Three more variables are read into the config object (`storageBucket`, `messagingSenderId`, `appId`) and none of them is required for the check, so a deployment with only the first three is a supported configuration rather than a half-configured one. When all three are absent, `initializeApp` is never called, no Firebase module is ever imported, and `ensureAuth()` and `ensureFirestore()` both resolve to `null` rather than throwing.

Every consumer null-checks rather than assuming:

| Consumer                                                                                                                | Guard                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [`contexts/project-context.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/contexts/project-context.tsx) | `const syncEnabled = !!(user && isFirebaseConfigured())`                                               |
| [`contexts/auth-context.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/contexts/auth-context.tsx)       | early return when `!isFirebaseConfigured()` or `typeof window === "undefined"`                         |
| [`lib/sharing.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/sharing.ts)                             | `if (!db) return` at the top of every exported function                                                |
| [`tests/components/setup.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/components/setup.ts)       | mocks `@/lib/firebase` to `null` services, so the whole component suite runs in the unconfigured state |

That last row is the useful one. The 48-tool render suite and the axe suite both execute with Firebase unconfigured, so the signed-out path is not a theory; it is the path every component test takes.

The `syncEnabled` guard in the first row lost a clause recently, and the comment records why: it used to also require an already-initialised `db`, which became circular the moment Firestore started loading on demand, because nothing would ever give it a reason to load.

## The SDK is not on the critical path

`lib/firebase.ts` contains no value import of Firebase. The three imports it does have are `import type`, which [erase at compile time](https://www.typescriptlang.org/docs/handbook/modules/reference.html#type-only-imports-and-exports) and emit no `require` and no `import`:

```ts
import type { FirebaseApp } from "firebase/app"
import type { Auth, GoogleAuthProvider } from "firebase/auth"
import type { Firestore } from "firebase/firestore"
```

The real imports are three [dynamic `import()` calls](https://tc39.es/ecma262/#sec-import-calls), each behind a memo slot so a second caller reuses the first caller's promise:

```ts
export function ensureAuth(): Promise<FirebaseAuthServices | null> {
  if (!isFirebaseConfigured()) return Promise.resolve(null)
  authPromise ??= loadAuth()
  return authPromise
}

async function loadAuth(): Promise<FirebaseAuthServices> {
  const [app, mod] = await Promise.all([ensureApp(), import("firebase/auth")])
  auth = mod.getAuth(app)
  googleProvider = new mod.GoogleAuthProvider()
  googleProvider.setCustomParameters({ prompt: "select_account" })
  return { auth, googleProvider }
}
```

`auth`, `db` and `googleProvider` are still exported, but they are now `let` rather than `const`, and they are `null` until the matching loader resolves. That works because an ES import is [a live binding to the exporting module's variable](https://tc39.es/ecma262/#sec-createimportbinding) rather than a copy of its value, so a consumer that imported `auth` at module scope and reads it inside a click handler sees the initialised object. A consumer that read it at module scope into a local would see `null` forever; nothing in the tree does that.

Auth and Firestore are deliberately separate entry points, and the comment on `ensureFirestore` gives the reason: signing in should not have to wait for the Firestore chunk. Firestore is by far the larger of the two, which is measurable directly from the dependency in this tree rather than from a build:

```bash
# from the repository root, against node_modules/firebase 12.16.0
for f in firebase-app.js firebase-auth.js firebase-firestore.js; do
  printf '%s raw=%s gzip=%s\n' "$f" \
    "$(wc -c < node_modules/firebase/$f)" \
    "$(gzip -9 -c node_modules/firebase/$f | wc -c)"
done
```

| Vendored bundle         | Raw bytes | `gzip -9` bytes |
| ----------------------- | --------- | --------------- |
| `firebase-app.js`       | 103,069   | 23,160          |
| `firebase-auth.js`      | 155,200   | 41,062          |
| `firebase-firestore.js` | 705,482   | 179,467         |

Read those as an upper bound on what the SDK can cost rather than as the app's chunk sizes: they are Firebase's own standalone browser builds, each of which inlines its shared internals, whereas the app's bundler tree-shakes and deduplicates them. The point the table settles is the ordering, and it is the reason the sign-in path awaits only `ensureAuth()`. The app's own first-load figures were not re-measured for this page, because building the app is outside what this documentation pass runs.

:::caution
One account surface is still statically linked to the SDK, so "the SDK is off the critical path" is the accurate claim and "a signed-out visitor never fetches a Firebase byte" is not. [`components/header.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/header.tsx) loads the account menu through `next/dynamic` with `ssr: false`, which keeps it out of the first load, but [`components/ui/user-menu.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/ui/user-menu.tsx) imports `AccountSettingsDialog` statically, and that dialog imports `updateProfile`, `updateEmail`, `updatePassword`, `reauthenticateWithCredential` and `EmailAuthProvider` from `firebase/auth` as values. So `firebase/auth` sits in the account-menu chunk, which is fetched on client mount for every visitor. Firestore is not in that chunk, and `initializeApp` still never runs for a signed-out visitor.
:::

### Deciding whether to load the SDK without loading the SDK

The awkward part of lazy auth is that "are you signed in?" is normally a question only the SDK can answer, which would make every page load pay for it. The app answers it from storage instead.

```text
decision = hint            when hint is known
         = legacyProbe     when hint is absent

where:
  hint        = localStorage["netdash-auth-session"], "1" | "0" | absent
  legacyProbe = whether indexedDB reports a database named
                "firebaseLocalStorageDb", which is where Firebase Auth
                persists its own session
  decision    = true  -> attach the auth listener, which loads the SDK
              = false -> render signed out, load nothing
```

The hint is written by the auth listener on every state change and again on explicit sign-out, so a browser that has ever run this app carries a definite answer. The probe exists only for sessions created before the hint did, and [`indexedDB.databases()`](https://w3c.github.io/IndexedDB/#dom-idbfactory-databases) is not universally implemented, so the code fails open rather than guessing:

```ts
async function hasLegacyAuthDatabase(): Promise<boolean> {
  try {
    // reading the global itself throws when storage is blocked, so the guard has
    // to be inside the try: this used to reject and hang the auth provider
    if (typeof indexedDB === "undefined") return false
    if (typeof indexedDB.databases === "function") {
      const databases = await indexedDB.databases()
      return databases.some((entry) => entry.name === FIREBASE_AUTH_DB)
    }
  } catch {
    // fall through
  }
  // cannot tell: load the sdk rather than show a signed-in user as signed out
  return true
}
```

The `try` starting one line earlier than it looks like it should is load-bearing. In a browser with storage blocked, merely _reading_ `indexedDB` throws a `SecurityError`, so a `typeof` guard outside the `try` rejected the promise, which left the auth provider awaiting forever and the whole app in its loading state.

Worked, for the four cases that actually occur:

```text
1. returning signed-in visitor, any browser
   hint = "1"                    -> load the sdk, restore the session

2. returning signed-out visitor, any browser
   hint = "0"                    -> load nothing. one localStorage read.

3. first visit, browser with indexedDB.databases()   (Chrome, Edge)
   hint = absent, probe = false  -> load nothing, and write hint = "0"
   every later load is case 2

4. first visit, browser without indexedDB.databases()   (Firefox, Safari)
   hint = absent, probe = true   -> load the sdk, find no user,
                                    the listener writes hint = "0"
   every later load is case 2
```

Case 4 is the honest cost of the design: on Firefox and Safari, the very first page load of a browser profile fetches the auth SDK to prove a negative, and only that load. It is a deliberate trade, and the comment says so: showing a signed-in user as signed out is a worse failure than one wasted fetch. Nothing in `tests/` currently exercises `hasStoredSession`, the hint key or the probe, so the four cases above are read off the source rather than pinned by a gate.

## Exactly two products, and not a third

| Firebase product           | Used   | What for                                                                                                                                     |
| -------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication             | yes    | Google sign-in, email and password, password reset                                                                                           |
| Firestore                  | yes    | project documents and the sharing index                                                                                                      |
| Analytics                  | **no** | `getAnalytics` is imported nowhere; page analytics is Vercel's, covered on [what leaves your device](/docs/privacy/what-leaves-your-device/) |
| Storage                    | no     | a `storageBucket` value is passed in the config object and never used                                                                        |
| Cloud Functions, Messaging | no     | not imported                                                                                                                                 |

Only the first two rows are ever imported, and each is imported only when something asks for it. The `storageBucket` entry in the config is dead weight rather than a capability, and it is worth naming so nobody reads the config object as a list of things the app does.

## What is stored where

`localStorage` is the always-on primary store. It is written on every change and read on mount, whether or not you are signed in. Firestore is a sync layer on top, and only when `syncEnabled` is true.

| `localStorage` key         | Value                                                                                                        | Written when                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `netdash-projects`         | the full project array, as JSON                                                                              | every change to the project list, once the initial load has finished       |
| `netdash-deleted-projects` | `[[projectId, uid \| null], ...]`, capped at 200 entries; a bare string is the older format and still parses | immediately before a delete request, and again when a tombstone is retired |
| `netdash-auth-session`     | `"1"` or `"0"`                                                                                               | every auth state change, and on explicit sign-out                          |
| `netdash-recent-tools`     | recently opened tool slugs, for the command palette                                                          | opening a tool from the palette                                            |
| `netdash-sidebar-groups`   | which sidebar category groups you left open                                                                  | collapsing or expanding a group                                            |

The last two are interface state rather than data, and they are listed because "what is stored on your device" should be a complete answer rather than an interesting one.

| Firestore path                     | Contents                                          | Written by                                       |
| ---------------------------------- | ------------------------------------------------- | ------------------------------------------------ |
| `users/{uid}`                      | `email`, `displayName`, `photoURL`, merged        | sign-in                                          |
| `users/{uid}/projects/{projectId}` | the full project, plus `ownerId` and `ownerEmail` | saving or editing a project                      |
| `userIndex/{normalizedEmail}`      | an email to user-id index                         | sharing a project by email                       |
| `projectShares/{autoId}`           | a "shared with me" pointer                        | sharing, in the same batch as the project update |

A project contains whatever the saving tool put in it: a subnet calculation, a VLSM plan, an ACL, a port-scan result. So if you save a port scan of an internal host, that host's address is in Firestore. That is the direct consequence of the feature and it is the reason saving is opt-in per result rather than automatic.

We never see or store your password. Email and password sign-in goes through Firebase Auth, and the app only ever holds the resulting user object.

## Deleting a project, and the tombstone that makes it stick

A deleted project used to come back after a refresh. Two independent defects produced that, and the fix is worth walking through because the shape of it generalises.

### Defect one: "no user" was read as "no cloud"

`deleteFromCloud` used to treat a null `user` as proof that there was nothing in the cloud to delete, and return success. But auth resolves asynchronously, so on a fresh page load there is a window in which Firebase is fully configured, a session exists, and `user` is still `null`. A delete issued in that window removed the project locally, left the Firestore document untouched, and the next snapshot put it back. The order of the guards is now the fix:

```ts
// "no user" is not the same as "no cloud". if firebase is configured, the
// project may exist in firestore under an account whose auth has not
// resolved yet, and reporting success here deletes it locally while
// leaving the cloud copy to be restored by the next snapshot. that is the
// resurrection the user actually saw.
if (!isFirebaseConfigured()) return true
if (!user) {
  // still resolving is the dangerous case: a cloud copy may exist under an
  // account we are about to learn about. genuinely signed out is not, and
  // refusing there means a visitor can never delete their own local work.
  if (authLoading) {
    throw new Error("Still signing in, so the cloud copy could not be deleted. Try again.")
  }
  // the tombstone survives, so the first snapshot after sign-in removes it
  return true
}
```

Three questions in order, and the middle one is the interesting one. "Is there a cloud at all" comes first. Then a null `user` is split by `authLoading`: still resolving is refused, because a cloud copy may exist under an account the app is about to learn about, while genuinely signed out succeeds locally, because refusing there would mean a visitor who never signs in can never delete their own work. The tombstone carries the difference forward, and the first snapshot after a later sign-in issues the cloud delete. [`tests/components/project-delete.test.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/components/project-delete.test.tsx) pins the refusal in "does not report success when it never reached the cloud".

### Defect two: the snapshot merge re-uploaded the deletion

The Firestore listener merges the cloud snapshot with local state, and anything present locally but absent from the cloud is treated as local-only and uploaded. A just-deleted project fits that description perfectly, so the delete uploaded itself back. The merge now excludes tombstoned ids from the local-only set:

```ts
// a deleted project is never local-only: uploading it is exactly how a
// delete used to undo itself
const tombstoned = deletingIdsRef.current
const localOnlyProjects = localProjectsRef.current.filter(
  (p) => !cloudProjectIds.has(p.id) && !tombstoned.has(p.id)
)
```

The same set is applied a second time to the merged output, which is what suppresses an in-flight snapshot that still carries the cloud copy. "never re-uploads a project the user deleted" in the same test file replays exactly that snapshot and asserts the id appears in neither the rendered list nor the upload log.

### Why the guard has to be in storage

The guard started as an in-memory `Set` on a ref, and that cannot work, for a reason the code states in three lines:

```ts
// ids the user deleted. persisted, because an in-flight snapshot that still
// carries a deleted project used to re-upload it to firestore, and a refresh
// then read it straight back. an in-memory guard cannot survive that refresh.
const TOMBSTONE_KEY = "netdash-deleted-projects"
```

The failure is a race that outlives the page. A ref dies at unload; the re-uploaded document does not. So the window the ref was meant to cover is precisely the window in which the ref is destroyed. The tombstone is written **before** the request goes out, which is the other half of the same argument:

```ts
// written before the request, so a reload mid-delete still cannot resurrect it
deletingIdsRef.current = updateTombstones((ids) => ids.set(id, user?.uid ?? null))
```

On the next mount the tombstones are read before `netdash-projects` is parsed, so the filter can be applied to the stored array as it is loaded, and the persist effect then rewrites the key without the deleted entry. A tombstoned project is therefore erased from disk on the first load after the delete, not merely hidden.

Three properties of that write are each there for a specific failure:

| Property                                                                                                                               | Failure it prevents                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| It stores the deleting account's `uid` alongside the id, or `null` for a signed-out delete                                             | a second account's snapshot never carries the first account's document, so treating that absence as proof of deletion retired the tombstone and let the first account restore it    |
| `updateTombstones` re-reads storage, mutates, and writes back, rather than serialising this tab's copy                                 | two tabs deleting at once, where whichever wrote last erased the other's tombstone and re-uploaded its project                                                                      |
| A throwing [`setItem`](https://html.spec.whatwg.org/multipage/webstorage.html#dom-storage-setitem) is swallowed rather than propagated | private mode and a full quota, which must not stop you deleting a project, at the cost that on such a browser the tombstone lives only in memory and the refresh protection is lost |

The list is capped at 200 entries, newest kept, and the comment names the case that needs a cap: a browser that deletes but never signs in never receives a snapshot to retire anything, so without a bound the key would grow for the life of the profile.

### `deleteDoc` resolving is not the snapshot having caught up

This is the distinction the whole mechanism turns on, and the code splits it deliberately.

| Question                                 | Answer                              | Where                                                     |
| ---------------------------------------- | ----------------------------------- | --------------------------------------------------------- |
| Does the caller get `{ success: true }`? | on `await deleteDoc(...)` resolving | the delete handler returns immediately after              |
| Is the tombstone retired?                | **no**                              | only a snapshot whose id set lacks the project retires it |

`deleteDoc` resolving means the write was accepted. The `onSnapshot` listener is a separate stream with its own latency, and until it delivers a snapshot without the project, a snapshot taken before the write can still arrive carrying it. Retiring the tombstone at `deleteDoc` time reopens exactly the window it exists to close:

```ts
// the tombstone is retired by the snapshot that confirms the cloud copy is
// gone, not here: clearing it now reopens the window an in-flight snapshot
// used to walk through. with no cloud at all there is no such snapshot.
if (!isFirebaseConfigured()) {
  deletingIdsRef.current = updateTombstones((ids) => ids.delete(id))
}
```

The `!isFirebaseConfigured()` branch is the deployment with no Firebase, where there is no snapshot stream to wait for and the tombstone has nothing left to guard. Everywhere else, retirement happens in the snapshot handler, and only for tombstones this account is entitled to retire:

```ts
// a signed-out delete carries no uid, so the first account to sync
// claims it; another account's snapshot says nothing about this one
const ours = (uid: string | null) => uid === null || uid === user.uid

const confirmed = [...tombstoned]
  .filter(([id, uid]) => ours(uid) && !cloudProjectIds.has(id))
  .map(([id]) => id)
```

The same handler closes the other half, which is the case a tombstone alone cannot fix. A tombstone whose document is **still** in the snapshot means the delete never landed, because it was made offline, or signed out, or the write was rejected. Rather than leave the project hidden forever, the listener retries the delete:

```ts
const pending = [...deletingIdsRef.current]
  .filter(([id, uid]) => ours(uid) && cloudProjectIds.has(id))
  .map(([id]) => id)
for (const id of pending) {
  // a long offline spell can deliver many stale snapshots, and each
  // one would otherwise queue another write for the same document
  if (inFlightDeletesRef.current.has(id)) continue
  inFlightDeletesRef.current.add(id)
  deleteDoc(doc(firestore, "users", user.uid, "projects", id)).catch(/* ... */)
}
```

If that retry fails, the tombstone is dropped and the surviving project is put back into the list with a toast, because hiding a project that demonstrably still exists is the worse of the two errors. The `inFlightDeletesRef` guard is not decoration: reconnecting after a long offline spell can deliver a run of stale snapshots, and without it each one would queue another write for the same document.

### Worked, on the sequence that used to fail

```text
signed in as uid=u. project p1 exists locally and in the cloud.

t0   listener issues a query. the snapshot in flight contains p1.
t1   you delete p1.
       netdash-deleted-projects = [["p1","u"]]      # written before the request
       deleteDoc(users/u/projects/p1)               # in flight
       prune localProjectsRef and cloudIdsRef in the same tick
t2   the t0 snapshot arrives, still listing p1.
       localOnly = local \ cloud \ tombstoned       # p1 excluded twice over
       merged    = (cloud + localOnly) \ tombstoned # p1 not rendered
       uploads   = localOnly                        # p1 not uploaded
       pending   = tombstoned n cloud, ours(u)      # p1, but already in flight
                                                    # so no duplicate write
t3   deleteDoc resolves. the ui reports success. the tombstone stays.
t4   you reload the page before the next snapshot.
       readTombstones() -> Map { "p1" -> "u" } is read first
       netdash-projects is parsed, p1 filtered out, the key rewritten
t5   a fresh snapshot arrives without p1.
       ours("u") and "p1" not in cloudProjectIds -> the tombstone is retired
       netdash-deleted-projects = []
```

Every step from t2 onward is where the old code lost. At t2 it uploaded, at t4 it read the re-uploaded document straight back, and there was no t5 because there was nothing to retire.

### What this costs, stated plainly

- **A delete is confirmed on the write, not on the snapshot.** Waiting on the listener would make every delete feel slow, so "deleted" on screen means the server accepted the delete, not that the server has told us it is gone. The tombstone is what covers the gap between those two.
- **The tombstone list is capped at 200 ids and never expires by time.** A browser that deletes projects and never signs in has nothing to retire its entries, so the cap is what bounds the key; past 200, the oldest tombstone is dropped and, in the pathological case of more than 200 unconfirmed deletes on one profile, the oldest deleted project could reappear.
- **A signed-out delete is claimed by the first account that syncs.** Such a tombstone carries `null` instead of a `uid`, and `ours(null)` is true for every account, so if you delete signed out and then sign in to a different account than the one that holds the cloud copy, that account will treat the absence as confirmation and retire the tombstone. The narrower alternative would be to never retire a signed-out tombstone at all, which trades one edge case for an unbounded list.
- **Nothing in `tests/` names the tombstone key, the cap, the uid scoping or the retry.** `project-delete.test.tsx` covers the behaviour the mechanism exists to produce, which is the right thing to test, but it means a regression inside the mechanism can pass.

## The rules that enforce it

Access control is not application logic; it is in [`firestore.rules`](https://github.com/sunnypatell/netdash-toolkit/blob/main/firestore.rules), deployed by its own workflow.

| Rule                             | Effect                                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Profile read                     | any authenticated user; write, owner only                                                                                    |
| Project read                     | the owner, or a user present in the project's `sharedWith` map                                                               |
| Project create                   | rejected unless `ownerId` equals the calling user                                                                            |
| Project update by a collaborator | requires `permission` in `['edit','admin']`, **and** that `ownerId`, `sharedWith`, `ownerEmail` and `isShared` are unchanged |
| Project delete                   | owner only                                                                                                                   |
| `projectShares` read             | only the user the share points at; create, owner only                                                                        |

The fourth row is the one that matters most. Without the immutability check on `sharedWith`, a collaborator with edit permission could add themselves as admin, or re-share your project to a third party. Enforcing it in the rules rather than in the client means a direct SDK call cannot bypass it.

The last row is why the tombstone is a client-side concern rather than something the server could arbitrate: only the owner can delete, so a delete that fails is a delete that did not happen, and the client is the only party that knows the user asked.

The rules deploy through [`.github/workflows/firebase-deploy.yml`](https://github.com/sunnypatell/netdash-toolkit/blob/main/.github/workflows/firebase-deploy.yml), which is path-filtered to `firestore.rules` and its siblings, and which skips with a notice rather than failing when no service-account secret is present.

## One implementation note worth knowing

Firestore is initialized with `ignoreUndefinedProperties: true`, inside `loadFirestore`, and the comment explains why:

> Project carries optional sharing fields (`sharedWith`, `isShared`, `ownerEmail`), and firestore rejects an undefined value outright. every save of a project with an unset optional field used to throw and the error was swallowed, so cloud sync silently never happened.

That is a good illustration of why this page exists. A privacy claim like "your projects sync" was, for a period, false in a way nobody could see, because the failure was swallowed. The fix was a configuration flag; the lesson was that a silent catch is worse than a visible error, and it is the same lesson the tombstone teaches from the other direction.

## Deleting your data

- **Local only.** Clearing site data in your browser removes `netdash-projects`, `netdash-deleted-projects`, `netdash-auth-session` and everything in them.
- **Synced.** Deleting a project in the app deletes the Firestore document and tombstones the id locally until a snapshot confirms the document is gone; the batch also removes the `projectShares` pointer.
- **Everything.** Email [sunnypatel124555@gmail.com](mailto:sunnypatel124555@gmail.com) to have the account and its subcollection removed. There is no self-service account deletion in the app yet, and that is a gap rather than a policy.

## Not in scope (yet)

- **Self-service account deletion.** Currently an email request. Safe to defer only because the data set is small and the request path is documented; it should exist.
- **A test over the tombstone mechanism itself.** `project-delete.test.tsx` asserts the behaviour (nothing re-uploaded, nothing left in `netdash-projects`, no false success) but never names `netdash-deleted-projects`, never exercises the 200-entry cap, the uid scoping or the snapshot retry. The behaviour is gated; the mechanism is not.
- **End-to-end encryption of project contents.** Projects are stored as plain documents readable by the project owner and by anyone they share with, and by anyone holding the service account. Encrypting them client-side would break sharing and search, so it is deferred deliberately rather than overlooked.
- **A data export button.** You can read your projects out of `localStorage` today, which is not the same as an export.

:::note
We do not sell your data, we do not run advertising trackers, and there is no server of ours in the request path for any tool. The only durable storage is your own browser plus the optional Firestore documents listed above.
:::
