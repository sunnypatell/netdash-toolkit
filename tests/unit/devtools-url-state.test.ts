// @vitest-environment happy-dom
import { createElement, type ReactElement } from "react"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing"
import { AuthProvider } from "@/contexts/auth-context"
import { ProjectProvider } from "@/contexts/project-context"

import { Base64Encoder } from "@/components/tools/base64-encoder"
import { URLEncoder } from "@/components/tools/url-encoder"
import { JSONFormatter } from "@/components/tools/json-formatter"
import { HashGenerator } from "@/components/tools/hash-generator"
import { ColorConverter } from "@/components/tools/color-converter"
import { JWTDecoder } from "@/components/tools/jwt-decoder"
import { UserAgentParser } from "@/components/tools/user-agent-parser"

// the devtools tools put their mode and options in the query string so a result
// is a shareable link. the two payload-carrying ones deliberately do not: base64
// input and a pasted json document stay local, and a jwt never leaves the page.

function mount(node: ReactElement, searchParams = "", onUrlUpdate?: OnUrlUpdateFunction) {
  // children passed in the props object, not as a third argument: the adapter's
  // props type requires it and createElement's rest parameter does not satisfy it
  return render(
    createElement(NuqsTestingAdapter, {
      searchParams,
      onUrlUpdate,
      children: createElement(AuthProvider, null, createElement(ProjectProvider, null, node)),
    })
  )
}

function lastSearch(onUrlUpdate: ReturnType<typeof vi.fn>) {
  return onUrlUpdate.mock.calls.at(-1)?.[0].searchParams as URLSearchParams
}

afterEach(cleanup)

describe("base64 encoder", () => {
  it("opens in the mode and alphabet the link asks for", async () => {
    mount(createElement(Base64Encoder), "?mode=decode&alphabet=urlsafe")
    expect(await screen.findByLabelText(/base64 string/i)).toBeTruthy()
    const urlSafeRadio = screen.getByLabelText(/URL-safe/i) as HTMLInputElement
    expect(urlSafeRadio.checked).toBe(true)
  })

  it("decodes url-safe base64 that the old atob path rejected outright", async () => {
    mount(createElement(Base64Encoder), "?mode=decode&alphabet=urlsafe")
    // "😀?ÿ" in the rfc 4648 section 5 alphabet, unpadded
    await userEvent.type(screen.getByLabelText(/base64 string/i), "8J-YgD_Dvw")
    await waitFor(() =>
      expect((screen.getByLabelText(/plain text/i) as HTMLTextAreaElement).value).toBe("😀?ÿ")
    )
  })

  it("round-trips an emoji through the standard alphabet", async () => {
    mount(createElement(Base64Encoder), "?mode=encode")
    await userEvent.type(screen.getByLabelText(/plain text/i), "café 😀")
    await waitFor(() =>
      expect((screen.getByLabelText(/base64 string/i) as HTMLTextAreaElement).value).toBe(
        "Y2Fmw6kg8J+YgA=="
      )
    )
  })

  it("writes the alphabet to the url but never the payload", async () => {
    const onUrlUpdate = vi.fn()
    mount(createElement(Base64Encoder), "?mode=encode", onUrlUpdate)

    await userEvent.type(screen.getByLabelText(/plain text/i), "hunter2")
    await userEvent.click(screen.getByLabelText(/URL-safe/i))

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    const params = lastSearch(onUrlUpdate)
    expect(params.get("alphabet")).toBe("urlsafe")
    for (const [, value] of params) expect(value).not.toContain("hunter2")
  })

  it("has no Convert button, because there is nothing for it to do", () => {
    mount(createElement(Base64Encoder))
    expect(screen.queryByRole("button", { name: /^(convert|encode|decode)$/i })).toBeNull()
  })
})

describe("url encoder", () => {
  it("honours the encoding named in the link", async () => {
    mount(createElement(URLEncoder), "?mode=encode&enc=form&q=hello+world")
    // form-urlencoded writes a space as +, unlike encodeURIComponent's %20
    await waitFor(() =>
      expect((screen.getByLabelText(/url encoded/i) as HTMLTextAreaElement).value).toBe(
        "hello+world"
      )
    )
  })

  it("gives a different answer per encoding for the same input", async () => {
    const cases: [string, string][] = [
      ["component", "a%20b%2Fc!"],
      ["uri", "a%20b/c!"],
      ["form", "a+b%2Fc%21"],
      ["rfc3986", "a%20b%2Fc%21"],
    ]
    for (const [enc, expected] of cases) {
      const view = mount(createElement(URLEncoder), `?mode=encode&enc=${enc}&q=a+b%2Fc!`)
      await waitFor(() =>
        expect((screen.getByLabelText(/url encoded/i) as HTMLTextAreaElement).value).toBe(expected)
      )
      view.unmount()
    }
  })

  it("restores + to a space only when decoding form data", async () => {
    const form = mount(createElement(URLEncoder), "?mode=decode&enc=form&q=a%2Bb")
    await waitFor(() =>
      expect((screen.getByLabelText(/plain text/i) as HTMLTextAreaElement).value).toBe("a b")
    )
    form.unmount()

    mount(createElement(URLEncoder), "?mode=decode&enc=component&q=a%2Bb")
    await waitFor(() =>
      expect((screen.getByLabelText(/plain text/i) as HTMLTextAreaElement).value).toBe("a+b")
    )
  })

  it("builds a url from params carried in the link", async () => {
    mount(createElement(URLEncoder), "?mode=build&base=https%3A%2F%2Fex.com%2Fp&params=q%3Da+b")
    expect(await screen.findByText("https://ex.com/p?q=a+b")).toBeTruthy()
  })

  it("writes the encoding choice back to the url", async () => {
    const onUrlUpdate = vi.fn()
    mount(createElement(URLEncoder), "?mode=encode&enc=component&q=x", onUrlUpdate)
    await userEvent.click(screen.getByLabelText("form-urlencoded"))
    await waitFor(() => expect(lastSearch(onUrlUpdate).get("enc")).toBe("form"))
  })
})

describe("json formatter", () => {
  it("indents with a real tab when the link says tab", async () => {
    mount(createElement(JSONFormatter), "?indent=tab")
    await userEvent.type(screen.getByLabelText(/json input/i), '{{"a":1}')
    await waitFor(() =>
      // the old numeric 0 for "Tab" produced no whitespace at all
      expect((screen.getByLabelText(/formatted json output/i) as HTMLTextAreaElement).value).toBe(
        '{\n\t"a": 1\n}'
      )
    )
  })

  it("minifies when the link says so", async () => {
    mount(createElement(JSONFormatter), "?output=minify")
    await userEvent.type(screen.getByLabelText(/json input/i), '{{"a":  1}')
    await waitFor(() =>
      expect((screen.getByLabelText(/formatted json output/i) as HTMLTextAreaElement).value).toBe(
        '{"a":1}'
      )
    )
  })

  it("warns about a rounded integer and a dropped duplicate key", async () => {
    mount(createElement(JSONFormatter))
    await userEvent.click(screen.getByRole("button", { name: /load lossy sample/i }))
    expect(await screen.findByText(/JSON.parse rounds it to 9007199254740992/)).toBeTruthy()
    expect(await screen.findByText(/Duplicate key "role"/i)).toBeTruthy()
  })

  it("keeps the pasted document out of the url", async () => {
    const onUrlUpdate = vi.fn()
    mount(createElement(JSONFormatter), "", onUrlUpdate)
    await userEvent.type(screen.getByLabelText(/json input/i), '{{"secret":1}')
    // typing alone must not touch the query string at all
    expect(onUrlUpdate).not.toHaveBeenCalled()
  })

  it("has no Format or Minify action button left", () => {
    mount(createElement(JSONFormatter))
    expect(screen.queryByRole("button", { name: /^format$/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /^minify$/i })).toBeNull()
  })
})

describe("hash generator", () => {
  it("opens on the tab the link names", async () => {
    mount(createElement(HashGenerator), "?mode=file")
    expect(await screen.findByLabelText(/file to hash/i)).toBeTruthy()
  })

  it("hashes as you type and names the algorithm that verifies", async () => {
    mount(createElement(HashGenerator))
    await userEvent.type(await screen.findByLabelText(/text to hash/i), "abc")
    // fips 180-4 vector for sha-256 of "abc"
    expect(
      await screen.findByText("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    ).toBeTruthy()

    await userEvent.type(
      screen.getByLabelText(/verify hash/i),
      "a9993e364706816aba3e25717850c26c9cd0d89d"
    )
    expect(await screen.findByText(/Matches the SHA-1 digest/i)).toBeTruthy()
  })

  it("offers no algorithm Web Crypto cannot deliver", async () => {
    mount(createElement(HashGenerator))
    await screen.findByLabelText(/text to hash/i)
    expect(screen.getByText(/Not in the Web Crypto spec/i)).toBeTruthy()
    // md5 is named only as unavailable, never as a badge over a digest
    expect(screen.queryByRole("button", { name: /MD5/i })).toBeNull()
    for (const badge of screen.queryAllByText(/^MD5$/)) {
      expect(badge.closest("li")).not.toBeNull()
    }
  })

  it("keeps the text being hashed out of the url", async () => {
    const onUrlUpdate = vi.fn()
    mount(createElement(HashGenerator), "", onUrlUpdate)
    await userEvent.type(await screen.findByLabelText(/text to hash/i), "correct horse")
    expect(onUrlUpdate).not.toHaveBeenCalled()
  })
})

describe("color converter", () => {
  it("computes from the colour in the link with no interaction", async () => {
    mount(createElement(ColorConverter), "?c=%23ff0000")
    expect((await screen.findAllByText("rgb(255 0 0)")).length).toBeGreaterThan(0)
  })

  it("accepts a wide-gamut colour from a link", async () => {
    mount(createElement(ColorConverter), "?c=oklch(0.62%200.19%20260)")
    expect((await screen.findAllByText(/^oklch\(0\.62 0\.19 260\)$/)).length).toBeGreaterThan(0)
  })

  it("composites alpha before reporting contrast", async () => {
    // 50% black on white is about 4:1, not the 21:1 an opaque reading gives
    mount(createElement(ColorConverter), "?c=%2300000080&bg=%23ffffff")
    expect(await screen.findByText(/Alpha is 50%/i)).toBeTruthy()
    expect(screen.queryByText("21.00:1")).toBeNull()
  })

  it("writes an edited colour back to the url", async () => {
    const onUrlUpdate = vi.fn()
    mount(createElement(ColorConverter), "?c=%233b82f6", onUrlUpdate)
    const input = screen.getByLabelText(/color \(any css syntax\)/i)
    await userEvent.clear(input)
    await userEvent.type(input, "rebeccapurple")
    await waitFor(() => expect(lastSearch(onUrlUpdate).get("c")).toBe("rebeccapurple"))
  })
})

describe("user agent parser", () => {
  it("parses the ua carried in the link", async () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    mount(createElement(UserAgentParser), `?ua=${encodeURIComponent(ua)}`)
    expect(await screen.findByText(/Chrome 125/)).toBeTruthy()
  })

  it("does not call a real in-app browser a bot", async () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.5.78"
    mount(createElement(UserAgentParser), `?ua=${encodeURIComponent(ua)}`)
    await screen.findByText(/Chrome 125/)
    expect(screen.queryByText(/^Bot/i)).toBeNull()
  })
})

describe("jwt decoder keeps the token out of the url", () => {
  // obviously fake, generated for this test: header {"alg":"none"}, payload
  // {"sub":"fake-subject","name":"Test User"}, empty signature
  const UNSIGNED = "eyJhbGciOiJub25lIn0.eyJzdWIiOiJmYWtlLXN1YmplY3QiLCJuYW1lIjoiVGVzdCBVc2VyIn0."

  it("never writes the token to the query string", async () => {
    const onUrlUpdate = vi.fn()
    mount(createElement(JWTDecoder), "", onUrlUpdate)
    await userEvent.type(screen.getByLabelText(/jwt token/i), UNSIGNED)
    expect(onUrlUpdate).not.toHaveBeenCalled()
  })

  it("decodes alg none and says the token is unsigned", async () => {
    mount(createElement(JWTDecoder))
    await userEvent.type(screen.getByLabelText(/jwt token/i), UNSIGNED)
    expect(await screen.findByText(/this token is unsigned/i)).toBeTruthy()
    expect(screen.getByText(/\(empty - unsigned token\)/i)).toBeTruthy()
  })

  it("never implies it checked a signature", async () => {
    mount(createElement(JWTDecoder))
    await userEvent.type(screen.getByLabelText(/jwt token/i), UNSIGNED)
    expect(await screen.findByText(/signature not verified/i)).toBeTruthy()
    expect(screen.getByText(/it cannot and does not check the signature/i)).toBeTruthy()
    expect(screen.queryByText(/signature valid/i)).toBeNull()
  })
})
