---
title: Accounts and saved projects
description: How the optional Firebase account works in NetDash Toolkit, exactly what Firestore stores, and what happens when Firebase is not configured at all.
---

Signing in is optional and buys exactly one thing: saved projects that sync across devices. Every one of the 48 tools works signed out, and 11 of them can save output once you are signed in.

## Firebase is optional, and the code proves it

[`lib/firebase.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/firebase.ts) is 41 lines and gates everything on three environment variables:

```ts
export function isFirebaseConfigured(): boolean {
  return !!(apiKey && authDomain && projectId)
}
```

When those are absent, `initializeApp` is never called and `auth`, `db` and `googleProvider` are all exported as `null`. The SDK throws nothing because it was never started. `.env.example` states the consequence in one line: without these, the app works fully with `localStorage` only.

Every consumer null-checks rather than assuming:

| Consumer                                                                                                                | Guard                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [`contexts/project-context.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/contexts/project-context.tsx) | `const syncEnabled = !!(user && isFirebaseConfigured() && db)`                                         |
| [`contexts/auth-context.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/contexts/auth-context.tsx)       | early return when `!auth` or `typeof window === "undefined"`                                           |
| [`lib/sharing.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/sharing.ts)                             | `if (!db) return` at the top of every exported function                                                |
| [`tests/components/setup.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/components/setup.ts)       | mocks `@/lib/firebase` to `null` services, so the whole component suite runs in the unconfigured state |

That last row is the useful one. The 48-tool render suite and the axe suite both execute with Firebase unconfigured, so the signed-out path is not a theory; it is the path every component test takes.

## Exactly two products, and not a third

| Firebase product           | Used   | What for                                                                                                                                     |
| -------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication             | yes    | Google sign-in, email and password, password reset                                                                                           |
| Firestore                  | yes    | project documents and the sharing index                                                                                                      |
| Analytics                  | **no** | `getAnalytics` is imported nowhere; page analytics is Vercel's, covered on [what leaves your device](/docs/privacy/what-leaves-your-device/) |
| Storage                    | no     | a `storageBucket` value is passed in the config object and never used                                                                        |
| Cloud Functions, Messaging | no     | not imported                                                                                                                                 |

Only the first two rows exist in the bundle. The `storageBucket` entry in the config is dead weight rather than a capability, and it is worth naming so nobody reads the config object as a list of things the app does.

## What is stored where

`localStorage` is the always-on primary store, under the key `netdash-projects`. It is written on every change and read on mount, whether or not you are signed in. Firestore is a sync layer on top, and only when `syncEnabled` is true.

| Firestore path                     | Contents                                                           | Written by                                       |
| ---------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| `users/{uid}`                      | `email`, `displayName`, `photoURL`, `lastSeen`, `provider`, merged | sign-in                                          |
| `users/{uid}/projects/{projectId}` | the full project, plus `ownerId` and `ownerEmail`                  | saving or editing a project                      |
| `userIndex/{normalizedEmail}`      | an email to user-id index                                          | sharing a project by email                       |
| `projectShares/{autoId}`           | a "shared with me" pointer                                         | sharing, in the same batch as the project update |

A project contains whatever the saving tool put in it: a subnet calculation, a VLSM plan, an ACL, a port-scan result. So if you save a port scan of an internal host, that host's address is in Firestore. That is the direct consequence of the feature and it is the reason saving is opt-in per result rather than automatic.

We never see or store your password. Email and password sign-in goes through Firebase Auth, and the app only ever holds the resulting user object.

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

The rules deploy through [`.github/workflows/firebase-deploy.yml`](https://github.com/sunnypatell/netdash-toolkit/blob/main/.github/workflows/firebase-deploy.yml), which is path-filtered to `firestore.rules` and its siblings, and which skips with a notice rather than failing when no service-account secret is present.

## One implementation note worth knowing

Firestore is initialized with `ignoreUndefinedProperties: true`, and the comment explains why:

> Project carries optional sharing fields (`sharedWith`, `isShared`, `ownerEmail`), and firestore rejects an undefined value outright. every save of a project with an unset optional field used to throw and the error was swallowed, so cloud sync silently never happened.

That is a good illustration of why this page exists. A privacy claim like "your projects sync" was, for a period, false in a way nobody could see, because the failure was swallowed. The fix was a configuration flag; the lesson was that a silent catch is worse than a visible error.

## Deleting your data

- **Local only.** Clearing site data in your browser removes `netdash-projects` and everything in it.
- **Synced.** Deleting a project in the app deletes the Firestore document, and the batch also removes the `projectShares` pointer.
- **Everything.** Email [sunnypatel124555@gmail.com](mailto:sunnypatel124555@gmail.com) to have the account and its subcollection removed. There is no self-service account deletion in the app yet, and that is a gap rather than a policy.

## Not in scope (yet)

- **Self-service account deletion.** Currently an email request. Safe to defer only because the data set is small and the request path is documented; it should exist.
- **End-to-end encryption of project contents.** Projects are stored as plain documents readable by the project owner and by anyone they share with, and by anyone holding the service account. Encrypting them client-side would break sharing and search, so it is deferred deliberately rather than overlooked.
- **A data export button.** You can read your projects out of `localStorage` today, which is not the same as an export.

:::note
We do not sell your data, we do not run advertising trackers, and there is no server of ours in the request path for any tool. The only durable storage is your own browser plus the optional Firestore documents listed above.
:::
