// one route serves password reset, email verification and email recovery. the
// page is a client component so it cannot export metadata; layout.tsx carries
// the static title and the page narrows it from this map once ?mode= is read.
// kept out of page.tsx so the route file exports only what next expects.
export const MODE_TITLES: Record<string, string> = {
  resetPassword: "Reset Your Password",
  verifyEmail: "Verify Your Email Address",
  recoverEmail: "Recover Your Email Address",
  invalid: "Invalid or Expired Account Link",
}
