import type { Metadata } from "next"

// the page itself is a client component, so it cannot export metadata. this
// supplies the static title; the page narrows it per mode once ?mode= is read.
export const metadata: Metadata = {
  title: "Account Action: Password Reset and Email Verification",
  description:
    "Complete a password reset, email verification, or email recovery request from a link sent to your inbox.",
  robots: { index: false, follow: false },
}

export default function AuthActionLayout({ children }: { children: React.ReactNode }) {
  return children
}
