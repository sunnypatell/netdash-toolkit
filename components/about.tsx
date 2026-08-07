"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Github, Linkedin } from "@/components/icons/brand-icons"
import {
  BookOpen,
  ExternalLink,
  Globe,
  GitCommit,
  Plus,
  Bug,
  Wrench,
  Star,
  Heart,
  Coffee,
  Cloud,
  Monitor,
  WifiOff,
} from "lucide-react"
import changelogData from "@/data/changelog.json"
import { categories, isOffline, offlineToolCount, tools } from "@/lib/tool-registry"
import { REPO_URL } from "@/lib/site"

// docs are static astro output copied into public/, not a next route
const DOCS_URL = "/docs/"
const RELEASES_URL = `${REPO_URL}/releases/latest`

const changelog = changelogData.releases
const offlineCount = offlineToolCount()
const networkTools = tools.filter((t) => !isOffline(t))

// the browser/desktop split is stated once here instead of re-explained inside five tools
const desktopTools = tools.filter((t) => (t.runtime?.desktopOnly?.length ?? 0) > 0)

const algorithms = [
  {
    title: "IPv4 subnet math",
    detail:
      "Network = IP & Mask, Broadcast = Network | ~Mask, on unsigned 32-bit values so the high octet cannot overflow into a negative.",
  },
  {
    title: "VLSM allocation",
    detail:
      "Sort subnets by host count descending, pick the prefix p where 2^(32-p)-2 >= hosts, then place each block on its own binary boundary.",
  },
  {
    title: "IPv6 compression",
    detail:
      "RFC 5952: drop leading zeros per group, then replace the single longest run of zero groups with :: exactly once.",
  },
  {
    title: "Conflict detection",
    detail:
      "Parses ARP tables, DHCP leases and MAC tables, correlates addresses across sources, and reports the evidence rather than a verdict.",
  },
]

const getVersionBadgeVariant = (type: string) => {
  switch (type) {
    case "major":
      return "default"
    case "minor":
      return "secondary"
    default:
      return "outline"
  }
}

const getVersionIcon = (type: string) => {
  switch (type) {
    case "major":
      return Star
    case "minor":
      return Plus
    case "patch":
      return Bug
    default:
      return Wrench
  }
}

export function About() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="eyebrow">About</p>
        <h1 className="text-3xl font-semibold text-balance sm:text-4xl">NetDash Toolkit</h1>
        <p className="text-muted-foreground max-w-3xl leading-relaxed text-pretty">
          {tools.length} network engineering utilities in one static site: subnetting, addressing,
          config generation, diagnostics, reference tables and a handful of everyday developer
          tools. There is no backend. {offlineCount} of the {tools.length} tools run offline and
          never leave your browser, and the remaining {networkTools.length} name the host they
          contact before they send anything.
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1">
            <WifiOff className="size-3" aria-hidden="true" />
            {offlineCount} run offline
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Cloud className="size-3" aria-hidden="true" />
            {networkTools.length} send data
          </Badge>
          <Badge variant="outline">{categories.length} categories</Badge>
          <Badge variant="outline">WCAG 2.2 AA</Badge>
          <Badge variant="outline">Free, no account required</Badge>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Where your input goes</CardTitle>
          <CardDescription>
            The full list, not a summary. Anything not on it never leaves your browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            Subnet math, VLSM planning, address conversion, config generation, encoding, hashing and
            every reference table run on the values you type and nothing else. No request is made
            until you press a button. The site itself records page views through Vercel Analytics,
            which sees the URL you visited and never the contents of a tool.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-md text-left text-sm">
              <caption className="sr-only">
                Tools that make network requests, and the hosts they contact
              </caption>
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Tool
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Contacts
                  </th>
                </tr>
              </thead>
              <tbody>
                {networkTools.map((tool) => (
                  <tr key={tool.slug} className="border-border/60 border-b last:border-0">
                    <td className="py-2 pr-4 align-top">
                      <Link
                        href={`/tools/${tool.slug}`}
                        className="focus-visible:ring-ring focus-visible:ring-offset-background rounded underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                      >
                        {tool.title}
                      </Link>
                    </td>
                    <td className="text-muted-foreground py-2 align-top font-mono text-xs">
                      {tool.runtime?.thirdParty?.join(", ") ?? "not declared"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            <a
              href={`${DOCS_URL}privacy/what-leaves-your-device/`}
              className="text-foreground focus-visible:ring-ring focus-visible:ring-offset-background rounded underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              What leaves your device
            </a>{" "}
            in the docs breaks the same list down by capability, names who operates each host, and
            says what it receives.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How it is built</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-3 text-sm leading-relaxed">
            <p>
              Next.js App Router exported as static HTML. Every tool is its own lazily loaded chunk,
              so opening one tool does not download the other {tools.length - 1}. State that belongs
              in a link lives in the URL, so a calculation can be shared by copying the address bar.
            </p>
            <p>
              Projects are stored in your browser. Cloud sync is opt-in and does nothing until you
              sign in, so the default install talks to no account service at all.
            </p>
            <p>
              The same code ships as an Electron desktop app, which adds the operations a browser is
              not permitted to perform at all.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Monitor className="size-4" aria-hidden="true" />
              What the desktop build adds
            </CardTitle>
            <CardDescription>
              Named per tool, because the browser versions cannot do these and do not pretend to.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {desktopTools.map((tool) => (
                <li key={tool.slug} className="flex flex-col gap-0.5">
                  <span className="font-medium">{tool.title}</span>
                  <span className="text-muted-foreground text-xs leading-relaxed">
                    {tool.runtime?.desktopOnly?.join(", ")}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
              In the browser, the ping tool measures an HTTPS round trip. That is a useful
              reachability signal, but it is not ICMP and the tool says so.
            </p>
            {/* the app names the desktop build in ten places and linked it in none */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
                  <Monitor className="size-4" aria-hidden="true" />
                  Download for macOS, Windows or Linux
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              </Button>
            </div>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              Builds are ad-hoc signed rather than notarized, so macOS asks before opening one. The
              release notes carry SHA-256 checksums and build provenance if you want to check what
              you downloaded.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How the math is done</CardTitle>
          <CardDescription>The four calculations most likely to be wrong elsewhere</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {algorithms.map((algorithm) => (
              <div key={algorithm.title} className="border-border rounded-lg border p-4">
                <h3 className="text-sm font-semibold">{algorithm.title}</h3>
                <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                  {algorithm.detail}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Accessibility</CardTitle>
          <CardDescription>What the WCAG 2.2 AA claim is actually backed by</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3 text-sm leading-relaxed">
          <p>
            All {tools.length} tools are mounted in CI and run through axe-core against the full 2.2
            AA rule set on every commit. Colour contrast is asserted separately, straight from the
            design tokens, because an automated checker cannot measure a page that never painted.
          </p>
          <p>
            Automated checks cover roughly a third of the success criteria. The rest, focus order,
            meaningful sequence and sensible labels, are reviewed by hand. Every interactive target
            is at least 24 by 24 CSS pixels, and the interface is usable from 320 pixels wide.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <GitCommit className="size-4" aria-hidden="true" />
            Changelog
          </CardTitle>
          <CardDescription>
            {changelog.length} releases, from v{changelog[changelog.length - 1]?.version} to v
            {changelog[0].version}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="scrollbar-slim h-128 pr-4">
            <div className="space-y-6">
              {changelog.map((release, index) => {
                const VersionIcon = getVersionIcon(release.type)
                return (
                  <div key={release.version} className="relative">
                    {index < changelog.length - 1 && (
                      <div
                        className="bg-border absolute top-8 bottom-0 left-4 w-px"
                        aria-hidden="true"
                      />
                    )}

                    <div className="flex items-start gap-4">
                      <div className="bg-background border-border flex size-8 shrink-0 items-center justify-center rounded-full border-2">
                        <VersionIcon className="text-muted-foreground size-4" aria-hidden="true" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="tabular text-base font-semibold">v{release.version}</h3>
                          <Badge variant={getVersionBadgeVariant(release.type)}>
                            {release.type}
                          </Badge>
                        </div>

                        <h4 className="text-foreground text-sm font-medium">{release.title}</h4>

                        <ul className="space-y-1">
                          {release.changes.map((change, changeIndex) => (
                            <li key={changeIndex} className="flex items-start gap-2 text-sm">
                              <span
                                className="bg-primary mt-2 size-1.5 shrink-0 rounded-full"
                                aria-hidden="true"
                              />
                              <span className="text-muted-foreground leading-relaxed">
                                {change}
                              </span>
                            </li>
                          ))}
                        </ul>

                        {release.technical && release.technical.length > 0 && (
                          <ul className="space-y-1">
                            {release.technical.map((tech, techIndex) => (
                              <li key={techIndex} className="flex items-start gap-2">
                                <span
                                  className="bg-muted-foreground mt-2 size-1.5 shrink-0 rounded-full"
                                  aria-hidden="true"
                                />
                                <span className="text-muted-foreground font-mono text-xs leading-relaxed">
                                  {tech}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Who built it</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            Sunny Patel, a software engineer. The toolkit started as a subnet calculator that kept
            growing, and it stays free with no account and no ads. The source is on GitHub if you
            want to check any of the claims above.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={DOCS_URL}>
                <BookOpen className="size-4" aria-hidden="true" />
                Docs
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="https://www.sunnypatel.net/" target="_blank" rel="noopener noreferrer">
                <Globe className="size-4" aria-hidden="true" />
                Portfolio
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://github.com/sunnypatell/netdash-toolkit"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="size-4" aria-hidden="true" />
                Source
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://www.linkedin.com/in/sunny-patel-30b460204/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Linkedin className="size-4" aria-hidden="true" />
                LinkedIn
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://github.com/sponsors/sunnypatell"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Heart className="size-4" aria-hidden="true" />
                Sponsor
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://buymeacoffee.com/sunnypatell"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Coffee className="size-4" aria-hidden="true" />
                Buy me a coffee
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
