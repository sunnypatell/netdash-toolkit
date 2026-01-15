"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FolderPlus, Save, Plus } from "lucide-react"
import { useProjects, type ProjectItem } from "@/contexts/project-context"
import { useToast } from "@/hooks/use-toast"

interface SaveToProjectProps {
  itemType: ProjectItem["type"]
  itemName: string
  itemData: Record<string, unknown>
  toolSource: string
  variant?: "default" | "outline" | "ghost" | "secondary"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
}

export function SaveToProject({
  itemType,
  itemName,
  itemData,
  toolSource,
  variant = "outline",
  size = "sm",
  className,
}: SaveToProjectProps) {
  const { projects, addProject, addItemToProject } = useProjects()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [createNew, setCreateNew] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [itemNotes, setItemNotes] = useState("")

  const handleSave = async () => {
    try {
      let projectId = selectedProjectId

      // Create new project if selected
      if (createNew && newProjectName.trim()) {
        const newProject = await addProject({
          name: newProjectName.trim(),
          description: `Created from ${toolSource}`,
          items: [],
          tags: [itemType],
        })
        projectId = newProject.id
      }

      if (!projectId) {
        toast({
          title: "No project selected",
          description: "Please select a project or create a new one",
          variant: "destructive",
        })
        return
      }

      // Add item to project
      await addItemToProject(projectId, {
        type: itemType,
        name: itemName,
        data: itemData,
        toolSource,
        notes: itemNotes || undefined,
      })

      toast({
        title: "Saved to project",
        description: `${itemName} has been saved successfully`,
      })

      // Reset and close
      setOpen(false)
      setSelectedProjectId("")
      setCreateNew(false)
      setNewProjectName("")
      setItemNotes("")
    } catch (error) {
      toast({
        title: "Failed to save",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Save className="mr-2 h-4 w-4" aria-hidden="true" />
          Save to Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Save to Project</DialogTitle>
          <DialogDescription>
            Save this {itemType} configuration to a project for later use.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Configuration Name</Label>
            <Input value={itemName} disabled className="bg-muted" />
          </div>

          {!createNew ? (
            <div className="space-y-2">
              <Label htmlFor="project-select">Select Project</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger id="project-select">
                  <SelectValue placeholder="Choose a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.length === 0 ? (
                    <SelectItem value="_empty" disabled>
                      No projects yet
                    </SelectItem>
                  ) : (
                    projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name} ({project.items.length} items)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full"
                onClick={() => setCreateNew(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create New Project
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="new-project-name">New Project Name</Label>
              <Input
                id="new-project-name"
                placeholder="My Network Project"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
              />
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setCreateNew(false)}
              >
                Cancel - Select Existing
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="item-notes">Notes (optional)</Label>
            <Textarea
              id="item-notes"
              placeholder="Add any notes about this configuration..."
              value={itemNotes}
              onChange={(e) => setItemNotes(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!createNew && !selectedProjectId}>
            <FolderPlus className="mr-2 h-4 w-4" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
