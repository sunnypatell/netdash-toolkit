// @vitest-environment happy-dom
import { createElement, type ReactElement } from "react"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import axe from "axe-core"

import { TextPanel } from "@/components/tools/hash-generator/text"
import { FilePanel } from "@/components/tools/hash-generator/file"
import { EncodePanel } from "@/components/tools/url-encoder/encode"
import { DecodePanel } from "@/components/tools/url-encoder/decode"
import { BuildPanel } from "@/components/tools/url-encoder/build"

// hash-generator and url-encoder used to be single files whose tab bodies could
// only ever be exercised through the parent. each panel now takes props, so it
// mounts on its own with no provider, no router and no shared state blob.

const AXE_OPTIONS: axe.RunOptions = {
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
  },
  // happy-dom never paints, so contrast is asserted from tokens elsewhere
  rules: { "color-contrast": { enabled: false } },
}

async function violationsOf(container: HTMLElement) {
  const results = await axe.run(container, AXE_OPTIONS)
  return results.violations.map((v) => ({ id: v.id, help: v.help }))
}

afterEach(cleanup)

describe("hash generator panels render standalone", () => {
  it("text panel shows the value it is given and reports edits", async () => {
    const onChange = vi.fn()
    render(createElement(TextPanel, { value: "abc", onChange }))

    const textarea = screen.getByLabelText(/text to hash/i) as HTMLTextAreaElement
    expect(textarea.value).toBe("abc")
    await userEvent.type(textarea, "d")
    expect(onChange).toHaveBeenCalledWith("abcd")
  })

  it("text panel counts utf-8 bytes, not just characters", () => {
    render(createElement(TextPanel, { value: "café", onChange: vi.fn() }))
    expect(screen.getByText("4 chars")).toBeTruthy()
    // c a f + 2 bytes for the e-acute
    expect(screen.getByText(/5 B UTF-8/)).toBeTruthy()
  })

  it("file panel renders empty and with a file, without the text panel", () => {
    const onSelect = vi.fn()
    const view = render(createElement(FilePanel, { file: null, onSelect }))
    expect(screen.getByLabelText(/file to hash/i)).toBeTruthy()
    expect(screen.queryByLabelText(/text to hash/i)).toBeNull()
    view.unmount()

    const file = new File(["hello"], "notes.txt", { type: "text/plain" })
    render(createElement(FilePanel, { file, onSelect }))
    expect(screen.getByText("notes.txt")).toBeTruthy()
    expect(screen.getByRole("button", { name: /remove notes\.txt/i })).toBeTruthy()
  })

  it.each([
    ["text", () => createElement(TextPanel, { value: "abc", onChange: vi.fn() })],
    ["file", () => createElement(FilePanel, { file: null, onSelect: vi.fn() })],
  ])("%s panel has no accessibility violations on its own", async (_name, build) => {
    const { container } = render(build() as ReactElement)
    expect(await violationsOf(container)).toEqual([])
  })
})

describe("url encoder panels render standalone", () => {
  const encodingProps = { encoding: "component" as const, onEncodingChange: vi.fn() }

  it("encode panel transforms without any parent", async () => {
    render(createElement(EncodePanel, { ...encodingProps, text: "a b/c", onTextChange: vi.fn() }))
    await waitFor(() =>
      expect((screen.getByLabelText(/url encoded/i) as HTMLTextAreaElement).value).toBe("a%20b%2Fc")
    )
  })

  it("decode panel is the inverse and exposes the builder hand-off", async () => {
    const onParseIntoBuilder = vi.fn()
    render(
      createElement(DecodePanel, {
        ...encodingProps,
        text: "a%20b%2Fc",
        onTextChange: vi.fn(),
        onParseIntoBuilder,
      })
    )
    expect((screen.getByLabelText(/plain text/i) as HTMLTextAreaElement).value).toBe("a b/c")
    await userEvent.click(screen.getByRole("button", { name: /parse url into builder/i }))
    expect(onParseIntoBuilder).toHaveBeenCalled()
  })

  it("encode panel reports the encoding the user picks", async () => {
    const onEncodingChange = vi.fn()
    render(
      createElement(EncodePanel, {
        encoding: "component",
        onEncodingChange,
        text: "x",
        onTextChange: vi.fn(),
      })
    )
    await userEvent.click(screen.getByLabelText("form-urlencoded"))
    expect(onEncodingChange).toHaveBeenCalledWith("form")
  })

  it("build panel assembles a url from the params it is handed", () => {
    render(
      createElement(BuildPanel, {
        base: "https://ex.com/p",
        onBaseChange: vi.fn(),
        params: [{ key: "q", value: "hello world" }],
        onParamsChange: vi.fn(),
      })
    )
    expect(screen.getByText("https://ex.com/p?q=hello+world")).toBeTruthy()
  })

  it("build panel surfaces a relative base as an error", () => {
    render(
      createElement(BuildPanel, {
        base: "ex.com/p",
        onBaseChange: vi.fn(),
        params: [{ key: "", value: "" }],
        onParamsChange: vi.fn(),
      })
    )
    expect(screen.getByText(/scheme/i)).toBeTruthy()
  })

  it.each([
    [
      "encode",
      () => createElement(EncodePanel, { ...encodingProps, text: "a b", onTextChange: vi.fn() }),
    ],
    [
      "decode",
      () => createElement(DecodePanel, { ...encodingProps, text: "a%20b", onTextChange: vi.fn() }),
    ],
    [
      "build",
      () =>
        createElement(BuildPanel, {
          base: "https://ex.com",
          onBaseChange: vi.fn(),
          params: [{ key: "a", value: "1" }],
          onParamsChange: vi.fn(),
        }),
    ],
  ])("%s panel has no accessibility violations on its own", async (_name, build) => {
    const { container } = render(build() as ReactElement)
    expect(await violationsOf(container)).toEqual([])
  })
})
