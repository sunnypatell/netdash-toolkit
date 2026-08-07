"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

// a mount decision, not a css one: a css-hidden radix dialog still traps focus and locks body scroll
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const sync = () => setIsDesktop(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  return isDesktop
}

// owns the one piece of chrome state; navigation is real routes, so the chrome persists and every tool is deep-linkable
export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isDesktop = useIsDesktop()
  // radix restores focus to its own Trigger and this dialog has none, so remember what opened the drawer
  const openedFrom = useRef<HTMLElement | null>(null)

  const setDrawer = useCallback((open: boolean) => {
    if (open) openedFrom.current = document.activeElement as HTMLElement | null
    setSidebarOpen(open)
  }, [])

  const toggleSidebar = useCallback(() => setDrawer(!sidebarOpen), [setDrawer, sidebarOpen])

  return (
    <div className="bg-background flex h-dvh">
      {/* skip link for keyboard navigation (wcag 2.4.1) */}
      <a
        href="#main-content"
        className="bg-primary text-primary-foreground focus:ring-ring focus:ring-offset-background sr-only text-sm font-medium focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:px-4 focus:py-2 focus:ring-2 focus:ring-offset-2 focus:outline-none"
      >
        Skip to main content
      </a>

      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />

      {/* a real modal dialog: radix supplies the focus trap, escape handling and scroll lock the old overlay div never had */}
      {!isDesktop && (
        <DialogPrimitive.Root open={sidebarOpen} onOpenChange={setDrawer}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-40 bg-black/50" />
            <DialogPrimitive.Content
              aria-modal="true"
              aria-describedby={undefined}
              onCloseAutoFocus={(event) => {
                if (!openedFrom.current?.isConnected) return
                event.preventDefault()
                openedFrom.current.focus()
              }}
              className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left fixed inset-y-0 left-0 z-50 w-64 shadow-lg duration-300 outline-none"
            >
              <DialogPrimitive.Title className="sr-only">Navigation menu</DialogPrimitive.Title>
              <Sidebar variant="drawer" isOpen onToggle={() => setDrawer(false)} />
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />
        {/* the scroll container is the wrapper, not <main>: a <footer> nested in <main> gets no contentinfo landmark */}
        {/* a column so main can grow, or a short page leaves the footer stranded mid-viewport */}
        <div className="scrollbar-slim flex flex-1 flex-col overflow-auto">
          <main
            id="main-content"
            className="mx-auto w-full max-w-350 flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8"
            tabIndex={-1}
          >
            {children}
          </main>
          <Footer />
        </div>
      </div>
    </div>
  )
}
