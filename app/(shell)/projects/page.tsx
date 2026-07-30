import type { Metadata } from "next"
import { canonical } from "@/lib/site"
import { ProjectManager } from "@/components/project-manager"

export const metadata: Metadata = {
  title: "Projects",
  description: "Save, organize, and sync your network engineering work",
  // without its own canonical this inherits the root layout's, which points at
  // "/" and tells crawlers to fold this page into the homepage
  alternates: { canonical: canonical("/projects") },
  openGraph: {
    title: "Projects",
    description: "Save, organize, and sync your network engineering work",
    url: canonical("/projects"),
  },
  robots: { index: false, follow: true },
}

export default function ProjectsPage() {
  return <ProjectManager />
}
