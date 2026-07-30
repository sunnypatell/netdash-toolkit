import { AppShell } from "@/components/app-shell"
import { CommandPalette } from "@/components/command-palette"

// route group: everything except /auth/* renders inside the app chrome
export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {children}
      {/* mounted in the layout so cmd+k works on every route, including tools */}
      <CommandPalette />
    </AppShell>
  )
}
