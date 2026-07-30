import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// wcag 2.2 sc 3.3.8 accessible authentication (minimum), level aa, new in 2.2:
// https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html
// and sc 1.3.5 identify input purpose, level aa:
// https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html
//
// 3.3.8 forbids a cognitive function test in an authentication step unless an
// alternative exists. remembering and transcribing a password is such a test, so
// the criterion is met by letting a password manager do the work: paste must not
// be blocked, and the fields need autocomplete tokens for autofill to target
// them. 1.3.5 independently requires those tokens on fields collecting the
// user's own information.
//
// the tool components are excluded from the autocomplete requirement on purpose:
// every text field there takes a subject of analysis (a hostname to resolve, a
// wifi key to encode into a qr code), not information about the user, so 1.3.5
// does not bind them. that reasoning is spelled out in the conformance record.

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
  // onPaste is the attribute that can block a password manager. note that a bare
  // `onCopy=` match is not evidence of anything: the tools pass a copy-to-clipboard
  // callback by that name to their own components, which is unrelated.
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

  // scoped to the auth surfaces on purpose. wifi-qr-generator sets
  // autoComplete="off" on the wifi key field, which is correct: that is a third
  // party's network credential and should not be offered to the user's password
  // manager at all.
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
    // handleCodeInApp: true would switch firebase to an in-app code the user has
    // to carry across, which is exactly the transcription 3.3.8 is about
    expect(context).not.toMatch(/handleCodeInApp:\s*true/)
  })
})

describe("1.3.5 / 3.3.8: credential fields declare their purpose", () => {
  it.each(AUTH_SURFACES)("%s labels every password field for autofill", (file) => {
    const source = readFileSync(file, "utf8")
    const missing = inputTags(source)
      .filter((tag) => /type\s*=\s*"password"/.test(tag.attributes))
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
    // a new password must not be announced as the current one, or the manager
    // overwrites the stored credential with a half-typed value
    expect(source).toContain('autoComplete="new-password"')
  })
})
