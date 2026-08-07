import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// 3.3.8 and 1.3.5: met by letting a password manager work, so paste is unblocked and fields autofill

const AUTH_SURFACES = [
  join("components", "ui", "user-menu.tsx"),
  join("components", "ui", "account-settings-dialog.tsx"),
  join("app", "auth", "action", "page.tsx"),
]

function sourceFiles(): string[] {
  const out: string[] = []
  for (const root of ["components", "app", "contexts"]) {
    for (const rel of readdirSync(root, { recursive: true, encoding: "utf8" })) {
      if (/\.tsx?$/.test(rel)) out.push(join(root, rel))
    }
  }
  return out
}

const SOURCES = sourceFiles().map((file) => [file, readFileSync(file, "utf8")] as const)

/** every jsx opening tag for an Input or a native input, with its attributes */
function inputTags(source: string): Array<{ line: number; attributes: string }> {
  const out: Array<{ line: number; attributes: string }> = []
  const tag = /<(?:Input|input)(\s(?:[^<>"'{}]|"[^"]*"|'[^']*'|\{(?:[^{}]|\{[^{}]*\})*\})*)?\/?>/g
  for (const m of source.matchAll(tag)) {
    out.push({ line: source.slice(0, m.index).split("\n").length, attributes: m[1] ?? "" })
  }
  return out
}

const CREDENTIAL_TOKENS = ["username", "email", "current-password", "new-password", "one-time-code"]

describe("3.3.8 accessible authentication (minimum)", () => {
  // onPaste is what blocks a password manager; a bare `onCopy=` is the tools' own copy callback
  it("no clipboard event is intercepted on a dom element", () => {
    const blockers: string[] = []
    for (const [file, source] of SOURCES) {
      for (const m of source.matchAll(/onPaste\s*=/g)) {
        blockers.push(`${file}:${source.slice(0, m.index).split("\n").length}: onPaste`)
      }
      // a clipboard handler that cancels the event, however it is spelled
      for (const m of source.matchAll(/on(?:Paste|Copy|Cut)\s*=\s*\{[^}]{0,120}?preventDefault/g)) {
        blockers.push(
          `${file}:${source.slice(0, m.index).split("\n").length}: cancels a clipboard event`
        )
      }
    }
    expect(
      blockers,
      `blocking paste into a password field forces the user to transcribe it by hand, which is the cognitive function test 3.3.8 prohibits:\n${blockers.join("\n")}`
    ).toEqual([])
  })

  // wifi-qr-generator's autoComplete="off" is correct: that key is a third party's, not the user's
  it("no autocomplete is actively disabled on an auth surface", () => {
    const disabled: string[] = []
    for (const file of AUTH_SURFACES) {
      const source = readFileSync(file, "utf8")
      for (const m of source.matchAll(/autoComplete\s*=\s*"(?:off|nope|new)"/g)) {
        disabled.push(`${file}:${source.slice(0, m.index).split("\n").length}: ${m[0]}`)
      }
    }
    expect(disabled, disabled.join("\n")).toEqual([])
  })

  it("there is no captcha, puzzle, or image challenge in any auth path", () => {
    const challenges: string[] = []
    for (const [file, source] of SOURCES) {
      for (const m of source.matchAll(/recaptcha|hcaptcha|turnstile|friendly-?captcha/gi)) {
        challenges.push(`${file}:${source.slice(0, m.index).split("\n").length}: ${m[0]}`)
      }
    }
    expect(challenges, challenges.join("\n")).toEqual([])
  })

  it("password reset stays link-based, so no code is transcribed", () => {
    const context = readFileSync(join("contexts", "auth-context.tsx"), "utf8")
    // handleCodeInApp: true switches to a code the user must transcribe, which is what 3.3.8 forbids
    expect(context).not.toMatch(/handleCodeInApp:\s*true/)
  })
})

describe("1.3.5 / 3.3.8: credential fields declare their purpose", () => {
  // matched on the whole attribute list: a visibility toggle writes the type as an expression
  const CREDENTIAL_FIELD = /password/i

  it.each(AUTH_SURFACES)("%s labels every password field for autofill", (file) => {
    const source = readFileSync(file, "utf8")
    const missing = inputTags(source)
      .filter((tag) => CREDENTIAL_FIELD.test(tag.attributes))
      .filter((tag) => !/autoComplete\s*=/.test(tag.attributes))
      .map((tag) => `${file}:${tag.line}`)

    expect(
      missing,
      `a password field with no autocomplete token cannot be filled reliably by a password manager:\n${missing.join("\n")}`
    ).toEqual([])
  })

  it("every autocomplete token used on a credential field is a real one", () => {
    const bogus: string[] = []
    for (const file of AUTH_SURFACES) {
      const source = readFileSync(file, "utf8")
      for (const m of source.matchAll(/autoComplete\s*=\s*"([^"]+)"/g)) {
        if (!CREDENTIAL_TOKENS.includes(m[1])) {
          bogus.push(`${file}:${source.slice(0, m.index).split("\n").length}: "${m[1]}"`)
        }
      }
    }
    expect(bogus, `not in the html autofill field-name list:\n${bogus.join("\n")}`).toEqual([])
  })

  it("a sign-in form pairs a username token with a current-password token", () => {
    const source = readFileSync(join("components", "ui", "user-menu.tsx"), "utf8")
    expect(source).toContain('autoComplete="username"')
    expect(source).toContain('autoComplete="current-password"')
    // a new password announced as the current one makes the manager overwrite the stored credential
    expect(source).toContain('autoComplete="new-password"')
  })
})
