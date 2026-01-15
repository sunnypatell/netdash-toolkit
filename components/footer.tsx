"use client"

import { Button } from "@/components/ui/button"
import { ExternalLink, Github, Linkedin, Globe, Heart } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 border-t backdrop-blur">
      <div className="container mx-auto px-6 py-8">
        <div className="flex flex-col items-center justify-between space-y-4 md:flex-row md:space-y-0">
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center space-x-2 md:justify-start">
              <span className="text-foreground font-semibold">NetDash</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground text-sm">Network Engineering Dashboard</span>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Built with <Heart className="inline h-3 w-3 text-red-500" aria-hidden="true" />{" "}
              <span className="sr-only">love</span> by Sunny Patel
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" asChild>
              <a
                href="https://www.sunnypatel.net/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1"
                aria-label="Visit Sunny Patel's Portfolio (opens in new tab)"
              >
                <Globe className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Portfolio</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </Button>

            <Button variant="ghost" size="sm" asChild>
              <a
                href="https://github.com/sunnypatell/netdash-toolkit"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1"
                aria-label="View NetDash on GitHub (opens in new tab)"
              >
                <Github className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">GitHub</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </Button>

            <Button variant="ghost" size="sm" asChild>
              <a
                href="https://www.linkedin.com/in/sunny-patel-30b460204/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1"
                aria-label="Connect with Sunny Patel on LinkedIn (opens in new tab)"
              >
                <Linkedin className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">LinkedIn</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </Button>
          </div>
        </div>

        <div className="border-border mt-6 border-t pt-6 text-center">
          <p className="text-muted-foreground text-xs">
            © 2025 Sunny Patel. This is a demonstration of frontend development capabilities. All
            network calculations are performed client-side with no data transmission.
          </p>
        </div>
      </div>
    </footer>
  )
}
