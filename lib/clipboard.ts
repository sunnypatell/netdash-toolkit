// one clipboard path for the whole app. returns success so callers can show
// feedback; falls back to the legacy execCommand path for non-secure contexts
// (the electron build serves over http://127.0.0.1, which is treated as
// secure, but file previews and odd embeds are not).

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.style.position = "fixed"
    textarea.style.opacity = "0"
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}
