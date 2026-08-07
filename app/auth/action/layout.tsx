import type { Metadata } from "next"

// the page is a client component and cannot export metadata, so the static title lives here and the page narrows it per mode
export const metadata: Metadata = {
  title: "Account Action: Password Reset and Email Verification",
  description:
    "Complete a password reset, email verification, or email recovery request from a link sent to your inbox.",
  robots: { index: false, follow: false },
}

export default function AuthActionLayout({ children }: { children: React.ReactNode }) {
  return children
}
