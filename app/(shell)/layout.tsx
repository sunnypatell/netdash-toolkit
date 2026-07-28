import { AppShell } from "@/components/app-shell"

// route group: everything except /auth/* renders inside the app chrome
export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
