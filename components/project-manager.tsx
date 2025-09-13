"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FolderOpen } from "lucide-react"

export function ProjectManager() {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <FolderOpen className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Project Manager</h1>
          <p className="text-muted-foreground">Manage and organize your networking projects</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Management</CardTitle>
          <CardDescription>Save, load, and export your networking configurations and calculations</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Project manager implementation coming soon...</p>
        </CardContent>
      </Card>
    </div>
  )
}
