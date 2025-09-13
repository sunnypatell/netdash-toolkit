"use client"

import { Button } from "@/components/ui/button"
import { ExternalLink, Github, Linkedin, Globe, Heart } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="text-center md:text-left">
            <div className="flex items-center space-x-2 justify-center md:justify-start">
              <span className="font-semibold text-foreground">NetDash</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">Network Engineering Dashboard</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Built with <Heart className="w-3 h-3 inline text-red-500" /> by Sunny Patel
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" asChild>
              <a
                href="https://www.sunnypatel.net/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1"
              >
                <Globe className="w-4 h-4" />
                <span className="hidden sm:inline">Portfolio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </Button>

            <Button variant="ghost" size="sm" asChild>
              <a
                href="https://github.com/sunnypatell"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1"
              >
                <Github className="w-4 h-4" />
                <span className="hidden sm:inline">GitHub</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </Button>

            <Button variant="ghost" size="sm" asChild>
              <a
                href="https://www.linkedin.com/in/sunny-patel-30b460204/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1"
              >
                <Linkedin className="w-4 h-4" />
                <span className="hidden sm:inline">LinkedIn</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </Button>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            © 2025 Sunny Patel. This is a demonstration of frontend development capabilities. All network calculations
            are performed client-side with no data transmission.
          </p>
        </div>
      </div>
    </footer>
  )
}
