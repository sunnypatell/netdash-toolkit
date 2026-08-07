// the page is a client component and cannot export metadata, so layout.tsx holds the static title and the page narrows it from this map
export const MODE_TITLES: Record<string, string> = {
  resetPassword: "Reset Your Password",
  verifyEmail: "Verify Your Email Address",
  recoverEmail: "Recover Your Email Address",
  invalid: "Invalid or Expired Account Link",
}
