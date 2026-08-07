import { readFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// spawn and net.Socket replaced: proves what would have been spawned, and that handles are released

const state = vi.hoisted(() => {
  type Listener = (...args: unknown[]) => void

  class Emitter {
    private listeners = new Map<string, Listener[]>()

    on(event: string, listener: Listener): this {
      const list = this.listeners.get(event) ?? []
      list.push(listener)
      this.listeners.set(event, list)
      return this
    }

    emit(event: string, ...args: unknown[]): void {
      for (const listener of [...(this.listeners.get(event) ?? [])]) listener(...args)
    }
  }

  class FakeChild extends Emitter {
    stdout = new Emitter()
    stderr = new Emitter()
    killed = false
    signals: string[] = []

    kill(signal: string): boolean {
      this.killed = true
      this.signals.push(signal)
      return true
    }
  }

  const socketBehaviour = new Map<number, "connect" | "refuse" | "hang">()

  class FakeSocket extends Emitter {
    destroyed = false
    timeoutMs = 0
    connectedTo: { port: number; host: string } | null = null

    setTimeout(ms: number): void {
      this.timeoutMs = ms
    }

    destroy(): void {
      this.destroyed = true
      this.emit("close")
    }

    connect(port: number, host: string): void {
      this.connectedTo = { port, host }
      queueMicrotask(() => {
        const behaviour = socketBehaviour.get(port) ?? "hang"
        if (behaviour === "connect") this.emit("connect")
        else if (behaviour === "refuse") {
          this.emit("error", Object.assign(new Error("refused"), { code: "ECONNREFUSED" }))
        }
      })
    }
  }

  return {
    handlers: new Map<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>(),
    spawns: [] as Array<{ command: string; args: string[]; options: Record<string, unknown> }>,
    children: [] as FakeChild[],
    sockets: [] as FakeSocket[],
    socketBehaviour,
    FakeChild,
    FakeSocket,
  }
})

vi.mock("electron", () => ({
  ipcMain: {
    handle: (
      channel: string,
      handler: (event: unknown, ...args: unknown[]) => Promise<unknown>
    ) => {
      state.handlers.set(channel, handler)
    },
  },
}))

vi.mock("child_process", () => ({
  spawn: (command: string, args: string[], options: Record<string, unknown>) => {
    state.spawns.push({ command, args, options })
    const child = new state.FakeChild()
    state.children.push(child)
    return child
  },
}))

vi.mock("net", () => ({
  Socket: class extends state.FakeSocket {
    constructor() {
      super()
      state.sockets.push(this)
    }
  },
}))

vi.mock("fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("fs")>()),
  existsSync: () => true,
}))

const { registerNetworkHandlers, shutdownNetworkHandlers } =
  await import("@/electron/network/handlers")

const fixture = (name: string) => readFileSync(join(__dirname, "../fixtures", name), "utf8")

const invoke = (channel: string, ...args: unknown[]) => {
  const handler = state.handlers.get(channel)
  if (!handler) throw new Error(`no handler registered for ${channel}`)
  return handler({}, ...args)
}

// resolve the newest child that was spawned, as if the command had finished
const finishChild = (stdout: string, code = 0) => {
  const child = state.children[state.children.length - 1]
  child.stdout.emit("data", Buffer.from(stdout))
  child.emit("close", code)
}

beforeEach(() => {
  state.handlers.clear()
  state.spawns.length = 0
  state.children.length = 0
  state.sockets.length = 0
  state.socketBehaviour.clear()
  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
  registerNetworkHandlers()
})

afterEach(() => {
  shutdownNetworkHandlers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("spawn safety", () => {
  it("registers exactly the channels preload bridges", () => {
    expect([...state.handlers.keys()].sort()).toEqual([
      "network:arpTable",
      "network:dnsLookup",
      "network:getInterfaces",
      "network:ping",
      "network:portScan",
      "network:traceroute",
      "system:getInfo",
    ])
  })

  it("spawns an absolute path with an argument array and no shell", async () => {
    const result = invoke("network:ping", "192.0.2.1", { count: 2, timeout: 2000 })
    finishChild(fixture("ping-macos.txt"))
    await result

    const call = state.spawns[0]
    expect(call.command.startsWith("/")).toBe(true)
    expect(call.args).toContain("192.0.2.1")
    expect(call.options.shell).toBeUndefined()
    expect(call.options.windowsHide).toBe(true)
  })

  it("never spawns anything for a host that failed validation", async () => {
    for (const host of ["192.0.2.1; id", "-c", "$(id)", "", 42, null]) {
      const result = (await invoke("network:ping", host)) as { error?: string }
      expect(result.error).toBeTruthy()
    }
    expect(state.spawns).toHaveLength(0)
  })

  it("keeps non-numeric options off the command line", async () => {
    // options.count used to flow into Math.min unchecked and reach ping as the
    // literal string "NaN"
    const result = invoke("network:ping", "192.0.2.1", { count: "abc", timeout: {} })
    finishChild(fixture("ping-macos.txt"))
    await result

    for (const arg of state.spawns[0].args) {
      expect(arg).not.toContain("NaN")
    }
    expect(state.spawns[0].args).toContain("4") // the documented default count
  })

  it("clamps counts and hop limits to their documented bounds", async () => {
    const ping = invoke("network:ping", "192.0.2.1", { count: 10_000, timeout: 1 })
    finishChild(fixture("ping-macos.txt"))
    await ping
    expect(state.spawns[0].args[state.spawns[0].args.indexOf("-c") + 1]).toBe("10")

    const trace = invoke("network:traceroute", "192.0.2.1", { maxHops: 9999 })
    finishChild(fixture("traceroute-macos.txt"))
    await trace
    expect(state.spawns[1].args[state.spawns[1].args.indexOf("-m") + 1]).toBe("64")
  })
})

describe("ping handler", () => {
  it("reports the loss ping printed rather than deriving it from the count", async () => {
    const result = invoke("network:ping", "192.0.2.9", { count: 4 })
    finishChild(fixture("ping-linux-partial.txt"))

    expect(await result).toMatchObject({
      host: "192.0.2.9",
      alive: true,
      packetLoss: 50,
      times: [1.21, 1.44],
    })
  })

  it("surfaces a resolver failure instead of reporting it as 100% packet loss", async () => {
    const result = invoke("network:ping", "no-such-host.invalid")
    const child = state.children[0]
    // this text only ever reaches stderr, and discarding it made an unresolvable
    // name indistinguishable from a host that is simply down
    child.stderr.emit("data", Buffer.from("ping: cannot resolve no-such-host.invalid\n"))
    child.emit("close", 68)

    expect((await result) as { error?: string }).toMatchObject({
      alive: false,
      error: "ping: cannot resolve no-such-host.invalid",
    })
  })

  it("returns an error result rather than throwing when the binary is missing", async () => {
    const result = invoke("network:ping", "192.0.2.1")
    const child = state.children[0]
    child.emit("error", Object.assign(new Error("spawn ping ENOENT"), { code: "ENOENT" }))

    const value = (await result) as { alive: boolean; error?: string }
    expect(value.alive).toBe(false)
    expect(value.error).toContain("Command not found")
  })
})

describe("child process lifecycle", () => {
  it("escalates to SIGKILL when a child ignores SIGTERM", async () => {
    vi.useFakeTimers()

    const result = invoke("network:ping", "192.0.2.1", { count: 1, timeout: 1000 })
    await vi.advanceTimersByTimeAsync(6001) // count * timeout + 5000
    const child = state.children[0]
    expect(child.signals).toEqual(["SIGTERM"])

    // child.killed is true the moment a signal is sent, so escalation used to be
    // gated on a flag that was already set and never fired
    await vi.advanceTimersByTimeAsync(1001)
    expect(child.signals).toEqual(["SIGTERM", "SIGKILL"])

    expect((await result) as { error?: string }).toMatchObject({ alive: false })
  })

  it("stops tracking a child once it exits", async () => {
    const result = invoke("network:ping", "192.0.2.1")
    finishChild(fixture("ping-macos.txt"))
    await result

    shutdownNetworkHandlers()
    // a child that already closed must not be signalled again on quit
    expect(state.children[0].signals).toEqual([])
  })

  it("kills a child that is still running when the app quits", async () => {
    const result = invoke("network:ping", "192.0.2.1")
    shutdownNetworkHandlers()
    expect(state.children[0].signals).toEqual(["SIGKILL"])

    finishChild("", 1)
    await result
  })
})

describe("port scan handler", () => {
  it("classifies ports and destroys every socket it opened", async () => {
    state.socketBehaviour.set(80, "connect")
    state.socketBehaviour.set(81, "refuse")

    const results = (await invoke("network:portScan", "192.0.2.1", [80, 81], {
      timeout: 500,
    })) as Array<{ port: number; state: string; service?: string }>

    expect(results).toHaveLength(2)
    expect(results.find((r) => r.port === 80)).toMatchObject({ state: "open", service: "HTTP" })
    expect(results.find((r) => r.port === 81)).toMatchObject({ state: "closed" })
    for (const socket of state.sockets) expect(socket.destroyed).toBe(true)
  })

  it("opens one socket per distinct port, not per requested entry", async () => {
    state.socketBehaviour.set(443, "refuse")

    const results = (await invoke(
      "network:portScan",
      "192.0.2.1",
      [443, 443, 443, 443]
    )) as unknown[]
    expect(results).toHaveLength(1)
    expect(state.sockets).toHaveLength(1)
  })

  it("destroys in-flight sockets when the app quits mid-scan", async () => {
    state.socketBehaviour.set(9999, "hang")
    const scan = invoke("network:portScan", "192.0.2.1", [9999], { timeout: 10_000 })

    await Promise.resolve()
    shutdownNetworkHandlers()

    const results = (await scan) as Array<{ state: string }>
    expect(results[0].state).toBe("filtered")
    expect(state.sockets[0].destroyed).toBe(true)
  })

  it("opens no socket at all for input that failed validation", async () => {
    expect(await invoke("network:portScan", "192.0.2.1; id", [80])).toEqual([])
    expect(await invoke("network:portScan", "192.0.2.1", [0, 65536, "80"])).toEqual([])
    expect(await invoke("network:portScan", "192.0.2.1", "80")).toEqual([])
    expect(state.sockets).toHaveLength(0)
  })
})

describe("arp table handler", () => {
  it("reads the cache with a fixed argument list and ignores anything passed in", async () => {
    const result = invoke("network:arpTable", "192.168.1.0/24")
    finishChild(fixture("arp-macos.txt"))

    expect(await result).toHaveLength(3)
    expect(state.spawns[0].args).toEqual(["-a"])
  })
})
