import { Cloud, Monitor, WifiOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { isOffline, type ToolDefinition } from "@/lib/tool-registry"

// says, at the point of use, whether a tool leaves the device and where to.
// five tools each hand-rolled their own "Native Mode" alert while the seven
// third-party tools disclosed nothing at all.
//
// deliberately not a tooltip: hover-only disclosure fails wcag 2.2 1.4.13 for
// touch and keyboard users, and "where does my data go" is not supplementary.

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

// the full disclosure, as visible text. render near a tool's inputs so the user
// reads it before triggering a request, not after.
export function RuntimeDisclosure({ tool }: { tool: ToolDefinition }) {
  const runtime = tool.runtime
  // an offline tool can still have a desktop-only capability: conflict-checker
  // makes no request in the browser and reads the local arp cache on the
  // desktop. gating the whole disclosure on `offline === false` hid that.
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
