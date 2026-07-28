import type { Metadata } from "next"
import { ProjectManager } from "@/components/project-manager"

export const metadata: Metadata = {
  title: "Projects",
  description: "Save, organize, and sync your network engineering work",
}

export default function ProjectsPage() {
  return <ProjectManager />
}
