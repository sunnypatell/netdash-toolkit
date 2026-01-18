"use client"

import { useState, useMemo } from "react"
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
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { FolderOpen, FileDown, Users } from "lucide-react"
import { useProjects, type ProjectItem } from "@/contexts/project-context"
import { useToast } from "@/hooks/use-toast"

// Combined project type for unified handling
interface CombinedProject {
  id: string
  name: string
  items: ProjectItem[]
  isShared: boolean
  ownerEmail?: string
}

interface LoadFromProjectProps {
  itemType: ProjectItem["type"]
  onLoad: (data: Record<string, unknown>, item: ProjectItem) => void
  variant?: "default" | "outline" | "ghost" | "secondary"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
  disabled?: boolean
}

export function LoadFromProject({
  itemType,
  onLoad,
  variant = "outline",
  size = "sm",
  className,
  disabled = false,
}: LoadFromProjectProps) {
  const { projects, sharedProjects } = useProjects()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [selectedItemId, setSelectedItemId] = useState<string>("")

  // Combine own projects and shared projects
  const allProjects = useMemo((): CombinedProject[] => {
    const ownProjects: CombinedProject[] = projects.map((p) => ({
      id: p.id,
      name: p.name,
      items: p.items,
      isShared: false,
    }))

    const shared: CombinedProject[] = sharedProjects.map((p) => ({
      id: `shared-${p.id}`,
      name: p.name,
      items: p.items,
      isShared: true,
      ownerEmail: p.ownerEmail,
    }))

    return [...ownProjects, ...shared]
  }, [projects, sharedProjects])

  // Filter projects that have items of the specified type
  const projectsWithItems = useMemo(
    () => allProjects.filter((project) => project.items.some((item) => item.type === itemType)),
    [allProjects, itemType]
  )

  // Get items from selected project that match the type
  const selectedProject = useMemo(
    () => projectsWithItems.find((p) => p.id === selectedProjectId),
    [projectsWithItems, selectedProjectId]
  )
  const availableItems = useMemo(
    () => selectedProject?.items.filter((item) => item.type === itemType) || [],
    [selectedProject, itemType]
  )

  const handleLoad = () => {
    if (!selectedProjectId || !selectedItemId) {
      toast({
        title: "No item selected",
        description: "Please select a project and item to load",
        variant: "destructive",
      })
      return
    }

    const project = projectsWithItems.find((p) => p.id === selectedProjectId)
    const item = project?.items.find((i) => i.id === selectedItemId)

    if (!item) {
      toast({
        title: "Item not found",
        description: "The selected item could not be found",
        variant: "destructive",
      })
      return
    }

    try {
      onLoad(item.data, item)
      toast({
        title: "Configuration loaded",
        description: `Loaded "${item.name}" from ${project?.name}`,
      })
      setOpen(false)
      setSelectedProjectId("")
      setSelectedItemId("")
    } catch (error) {
      toast({
        title: "Failed to load",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      })
    }
  }

  const hasItems = projectsWithItems.length > 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          disabled={disabled || !hasItems}
        >
          <FolderOpen className="mr-2 h-4 w-4" aria-hidden="true" />
          Load from Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Load from Project</DialogTitle>
          <DialogDescription>
            Load a previously saved {itemType} configuration from your projects.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="project-select">Select Project</Label>
            <Select
              value={selectedProjectId}
              onValueChange={(value) => {
                setSelectedProjectId(value)
                setSelectedItemId("")
              }}
            >
              <SelectTrigger id="project-select">
                <SelectValue placeholder="Choose a project..." />
              </SelectTrigger>
              <SelectContent>
                {projectsWithItems.length === 0 ? (
                  <SelectItem value="_empty" disabled>
                    No projects with {itemType} configs
                  </SelectItem>
                ) : (
                  projectsWithItems.map((project) => {
                    const itemCount = project.items.filter((i) => i.type === itemType).length
                    return (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-2">
                          <span>{project.name}</span>
                          <span className="text-muted-foreground text-xs">
                            ({itemCount} {itemType}
                            {itemCount !== 1 ? "s" : ""})
                          </span>
                          {project.isShared && (
                            <Badge variant="secondary" className="ml-1 text-xs">
                              <Users className="mr-1 h-3 w-3" />
                              Shared
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    )
                  })
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedProjectId && (
            <div className="space-y-2">
              <Label htmlFor="item-select">Select Configuration</Label>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger id="item-select">
                  <SelectValue placeholder="Choose a configuration..." />
                </SelectTrigger>
                <SelectContent>
                  {availableItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex items-center gap-2">
                        <span>{item.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {item.toolSource}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedItemId && (
            <div className="bg-muted/50 rounded-lg border p-3">
              <div className="text-sm">
                <p className="font-medium">
                  {availableItems.find((i) => i.id === selectedItemId)?.name}
                </p>
                {availableItems.find((i) => i.id === selectedItemId)?.notes && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {availableItems.find((i) => i.id === selectedItemId)?.notes}
                  </p>
                )}
                <p className="text-muted-foreground mt-1 text-xs">
                  Saved:{" "}
                  {new Date(
                    availableItems.find((i) => i.id === selectedItemId)?.createdAt || ""
                  ).toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleLoad} disabled={!selectedItemId}>
            <FileDown className="mr-2 h-4 w-4" />
            Load
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
