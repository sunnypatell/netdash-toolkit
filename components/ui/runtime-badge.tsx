import { Cloud, Monitor, WifiOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { isOffline, type ToolDefinition } from "@/lib/tool-registry"

// discloses whether a tool leaves the device. not a tooltip: hover-only disclosure fails WCAG 1.4.13 for touch and keyboard.

export function RuntimeBadge({ tool }: { tool: ToolDefinition }) {
  if (isOffline(tool)) {
    return (
      <Badge variant="outline" className="gap-1 text-xs font-normal">
        <WifiOff className="h-3 w-3" aria-hidden="true" />
        Runs offline
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className="gap-1 border-amber-500/40 text-xs font-normal text-amber-700 dark:text-amber-400"
    >
      <Cloud className="h-3 w-3" aria-hidden="true" />
      Sends data
    </Badge>
  )
}

// visible text, rendered near a tool's inputs so it is read before the request rather than after
export function RuntimeDisclosure({ tool }: { tool: ToolDefinition }) {
  const runtime = tool.runtime
  // an offline tool can still have a desktop-only capability, so gating on `offline` alone hid conflict-checker's arp read
  const desktopOnly = runtime?.desktopOnly?.length ? runtime.desktopOnly : null
  if (!runtime || (runtime.offline && !desktopOnly)) return null

  return (
    <div className="text-muted-foreground space-y-1 text-xs">
      {runtime.offline === false && runtime.thirdParty?.length ? (
        <p>
          <Cloud className="mr-1 inline h-3 w-3 align-[-2px]" aria-hidden="true" />
          What you enter is sent to <strong>{runtime.thirdParty?.join(", ")}</strong>. Requests only
          happen when you ask for them.
        </p>
      ) : null}
      {desktopOnly && (
        <p>
          <Monitor className="mr-1 inline h-3 w-3 align-[-2px]" aria-hidden="true" />
          The desktop app adds {desktopOnly.join(", ")}, which a browser cannot do at all.
        </p>
      )}
    </div>
  )
}
