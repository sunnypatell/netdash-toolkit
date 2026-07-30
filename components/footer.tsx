"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BookOpen, ExternalLink, Globe, Heart, Monitor } from "lucide-react"
import { Github, Linkedin } from "@/components/icons/brand-icons"
import { REPO_URL, SITE_NAME } from "@/lib/site"

// the docs are an astro build copied into public/, so they are same-origin
// static files rather than a next route: a Link here would try to soft-navigate
// a page the router has never heard of
const DOCS_URL = "/docs/"
const RELEASES_URL = `${REPO_URL}/releases/latest`

export function Footer() {
  return (
    <footer className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 border-t backdrop-blur">
      <div className="container mx-auto px-6 py-8">
        <div className="flex flex-col items-center justify-between space-y-4 md:flex-row md:space-y-0">
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center space-x-2 md:justify-start">
              <span className="text-foreground font-semibold">{SITE_NAME}</span>
              <span className="text-muted-foreground">&bull;</span>
              <span className="text-muted-foreground text-sm">Network engineering tools</span>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Built with <Heart className="inline h-3 w-3 text-red-500" aria-hidden="true" />{" "}
              <span className="sr-only">love</span> by Sunny Patel
            </p>
          </div>

          {/* the docs site and the desktop build were both shipped and then never
              linked from anywhere in the app */}
          <nav aria-label="Site links" className="flex flex-wrap items-center justify-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <a href={DOCS_URL} className="flex items-center space-x-1">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                <span>Docs</span>
              </a>
            </Button>

            <Button variant="ghost" size="sm" asChild>
              <a
                href={RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1"
                aria-label="Desktop app downloads on GitHub (opens in new tab)"
              >
                <Monitor className="h-4 w-4" aria-hidden="true" />
                <span>Desktop app</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </Button>

            <Button variant="ghost" size="sm" asChild>
              <Link href="/about" className="flex items-center space-x-1">
                <span>About</span>
              </Link>
            </Button>

            <Button variant="ghost" size="sm" asChild>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1"
                aria-label={`${SITE_NAME} on GitHub (opens in new tab)`}
              >
                <Github className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">GitHub</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </Button>

            <Button variant="ghost" size="sm" asChild>
              <a
                href="https://www.sunnypatel.net/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1"
                aria-label="Sunny Patel's portfolio (opens in new tab)"
              >
                <Globe className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Portfolio</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </Button>

            <Button variant="ghost" size="sm" asChild>
              <a
                href="https://www.linkedin.com/in/sunny-patel-30b460204/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1"
                aria-label="Sunny Patel on LinkedIn (opens in new tab)"
              >
                <Linkedin className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">LinkedIn</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </Button>
          </nav>
        </div>

        <div className="border-border mt-6 border-t pt-6 text-center">
          {/* one sentence, the same two terms the rest of the app uses */}
          <p className="text-muted-foreground text-xs">
            &copy; {new Date().getFullYear()} Sunny Patel. Free to use, MIT licensed. Most tools run
            offline and never leave your browser; the ones that send data name the host first, and
            cloud sync is opt-in.
          </p>
        </div>
      </div>
    </footer>
  )
}
