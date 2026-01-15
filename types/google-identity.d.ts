// Google Identity Services types
interface GoogleAccountsId {
  initialize: (config: {
    client_id: string
    callback: (response: { credential: string; select_by?: string }) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
    context?: "signin" | "signup" | "use"
    itp_support?: boolean
    use_fedcm_for_prompt?: boolean
  }) => void
  prompt: (
    notification?: (notification: {
      isNotDisplayed: () => boolean
      isSkippedMoment: () => boolean
      isDismissedMoment: () => boolean
      getNotDisplayedReason: () => string
      getSkippedReason: () => string
      getDismissedReason: () => string
    }) => void
  ) => void
  cancel: () => void
  disableAutoSelect: () => void
  storeCredential: (credential: { id: string; password: string }) => void
  revoke: (hint: string, callback?: () => void) => void
}

interface GoogleAccounts {
  id: GoogleAccountsId
}

interface Google {
  accounts: GoogleAccounts
}

declare global {
  interface Window {
    google?: Google
  }
}

export {}
