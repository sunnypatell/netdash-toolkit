"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  FolderOpen,
  Plus,
  Save,
  Download,
  Upload,
  Trash2,
  Edit,
  FileText,
  Clock,
  Network,
  Shield,
  Globe,
  Calculator,
  Search,
  Copy,
  Check,
  AlertCircle,
  FolderPlus,
  Database,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// Project data types
interface ProjectItem {
  id: string
  type:
    | "subnet"
    | "vlsm"
    | "vlan"
    | "acl"
    | "dns"
    | "route"
    | "mtu"
    | "ipv6"
    | "conflict"
    | "oui"
    | "port-scan"
    | "other"
  name: string
  data: Record<string, unknown>
  createdAt: number
  notes?: string
}

interface Project {
  id: string
  name: string
  description: string
  items: ProjectItem[]
  createdAt: number
  updatedAt: number
  tags: string[]
}

// Storage key for localStorage
const STORAGE_KEY = "netdash-projects"

// Helper to generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

// Helper to format dates
const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Get icon for item type
const getItemIcon = (type: ProjectItem["type"]) => {
  const icons: Record<ProjectItem["type"], typeof Network> = {
    subnet: Calculator,
    vlsm: Network,
    vlan: Shield,
    acl: Shield,
    dns: Globe,
    route: Network,
    mtu: Calculator,
    ipv6: Network,
    conflict: AlertCircle,
    oui: Search,
    "port-scan": Shield,
    other: FileText,
  }
  return icons[type] || FileText
}

// Get label for item type
const getItemTypeLabel = (type: ProjectItem["type"]) => {
  const labels: Record<ProjectItem["type"], string> = {
    subnet: "Subnet Calculation",
    vlsm: "VLSM Plan",
    vlan: "VLAN Configuration",
    acl: "Access Control List",
    dns: "DNS Query",
    route: "Routing Configuration",
    mtu: "MTU Calculation",
    ipv6: "IPv6 Configuration",
    conflict: "IP Conflict Analysis",
    oui: "OUI Lookup",
    "port-scan": "Port Scan Result",
    other: "Other",
  }
  return labels[type] || "Other"
}

export function ProjectManager() {
  const { toast } = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Form states
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDescription, setNewProjectDescription] = useState("")
  const [newProjectTags, setNewProjectTags] = useState("")

  const [newItemName, setNewItemName] = useState("")
  const [newItemType, setNewItemType] = useState<ProjectItem["type"]>("other")
  const [newItemData, setNewItemData] = useState("")
  const [newItemNotes, setNewItemNotes] = useState("")

  // Load projects from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setProjects(Array.isArray(parsed) ? parsed : [])
      }
    } catch (error) {
      console.error("Failed to load projects:", error)
      toast({
        title: "Error loading projects",
        description: "Could not load saved projects from storage",
        variant: "destructive",
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Save projects to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
    } catch (error) {
      console.error("Failed to save projects:", error)
    }
  }, [projects])

  // Create a new project
  const createProject = () => {
    if (!newProjectName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a project name",
        variant: "destructive",
      })
      return
    }

    const newProject: Project = {
      id: generateId(),
      name: newProjectName.trim(),
      description: newProjectDescription.trim(),
      items: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: newProjectTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    }

    setProjects([newProject, ...projects])
    setSelectedProject(newProject)
    setNewProjectName("")
    setNewProjectDescription("")
    setNewProjectTags("")
    setIsCreateDialogOpen(false)

    toast({
      title: "Project created",
      description: `"${newProject.name}" has been created successfully`,
    })
  }

  // Update an existing project
  const updateProject = () => {
    if (!selectedProject || !newProjectName.trim()) return

    const updated = projects.map((p) =>
      p.id === selectedProject.id
        ? {
            ...p,
            name: newProjectName.trim(),
            description: newProjectDescription.trim(),
            tags: newProjectTags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
            updatedAt: Date.now(),
          }
        : p
    )

    setProjects(updated)
    const updatedProject = updated.find((p) => p.id === selectedProject.id)
    if (updatedProject) {
      setSelectedProject(updatedProject)
    }
    setIsEditDialogOpen(false)

    toast({
      title: "Project updated",
      description: "Changes have been saved",
    })
  }

  // Delete a project
  const deleteProject = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    setProjects(projects.filter((p) => p.id !== projectId))
    if (selectedProject?.id === projectId) {
      setSelectedProject(null)
    }

    toast({
      title: "Project deleted",
      description: project ? `"${project.name}" has been deleted` : "Project deleted",
    })
  }

  // Add item to selected project
  const addItemToProject = () => {
    if (!selectedProject || !newItemName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter an item name",
        variant: "destructive",
      })
      return
    }

    let parsedData: Record<string, unknown> = {}
    if (newItemData.trim()) {
      try {
        parsedData = JSON.parse(newItemData)
      } catch {
        // If not valid JSON, store as plain text
        parsedData = { rawData: newItemData }
      }
    }

    const newItem: ProjectItem = {
      id: generateId(),
      type: newItemType,
      name: newItemName.trim(),
      data: parsedData,
      createdAt: Date.now(),
      notes: newItemNotes.trim() || undefined,
    }

    const updated = projects.map((p) =>
      p.id === selectedProject.id
        ? {
            ...p,
            items: [...p.items, newItem],
            updatedAt: Date.now(),
          }
        : p
    )

    setProjects(updated)
    const updatedProject = updated.find((p) => p.id === selectedProject.id)
    if (updatedProject) {
      setSelectedProject(updatedProject)
    }

    setNewItemName("")
    setNewItemType("other")
    setNewItemData("")
    setNewItemNotes("")
    setIsAddItemDialogOpen(false)

    toast({
      title: "Item added",
      description: `"${newItem.name}" has been added to the project`,
    })
  }

  // Delete item from project
  const deleteItem = (itemId: string) => {
    if (!selectedProject) return

    const updated = projects.map((p) =>
      p.id === selectedProject.id
        ? {
            ...p,
            items: p.items.filter((i) => i.id !== itemId),
            updatedAt: Date.now(),
          }
        : p
    )

    setProjects(updated)
    const updatedProject = updated.find((p) => p.id === selectedProject.id)
    if (updatedProject) {
      setSelectedProject(updatedProject)
    }

    toast({
      title: "Item deleted",
      description: "Item has been removed from the project",
    })
  }

  // Export project to JSON
  const exportProject = (project: Project) => {
    const dataStr = JSON.stringify(project, null, 2)
    const blob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${project.name.toLowerCase().replace(/\s+/g, "-")}-project.json`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: "Project exported",
      description: `"${project.name}" has been exported as JSON`,
    })
  }

  // Export all projects
  const exportAllProjects = () => {
    if (projects.length === 0) {
      toast({
        title: "No projects",
        description: "There are no projects to export",
        variant: "destructive",
      })
      return
    }

    const dataStr = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        version: "1.0",
        projects,
      },
      null,
      2
    )
    const blob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `netdash-projects-backup-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: "All projects exported",
      description: `${projects.length} project(s) exported successfully`,
    })
  }

  // Import projects from JSON file
  const importProjects = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const parsed = JSON.parse(content)

        // Handle both single project and backup format
        if (parsed.projects && Array.isArray(parsed.projects)) {
          // Backup format
          const importedProjects = parsed.projects.map((p: Project) => ({
            ...p,
            id: generateId(), // Generate new IDs to avoid conflicts
            createdAt: p.createdAt || Date.now(),
            updatedAt: Date.now(),
          }))
          setProjects([...importedProjects, ...projects])
          toast({
            title: "Projects imported",
            description: `${importedProjects.length} project(s) imported successfully`,
          })
        } else if (parsed.name && parsed.items) {
          // Single project format
          const importedProject: Project = {
            ...parsed,
            id: generateId(),
            createdAt: parsed.createdAt || Date.now(),
            updatedAt: Date.now(),
          }
          setProjects([importedProject, ...projects])
          toast({
            title: "Project imported",
            description: `"${importedProject.name}" has been imported`,
          })
        } else {
          throw new Error("Invalid project format")
        }
      } catch (error) {
        console.error("Import error:", error)
        toast({
          title: "Import failed",
          description: "Could not parse the imported file. Please check the format.",
          variant: "destructive",
        })
      }
    }
    reader.readAsText(file)

    // Reset input
    event.target.value = ""
  }

  // Copy to clipboard
  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error("Copy failed:", err)
    }
  }

  // Open edit dialog with current project data
  const openEditDialog = () => {
    if (!selectedProject) return
    setNewProjectName(selectedProject.name)
    setNewProjectDescription(selectedProject.description)
    setNewProjectTags(selectedProject.tags.join(", "))
    setIsEditDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FolderOpen className="text-primary h-6 w-6" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold">Project Manager</h1>
            <p className="text-muted-foreground">
              Save, organize, and export your networking configurations
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="file"
            accept=".json"
            onChange={importProjects}
            className="sr-only"
            id="import-projects"
            aria-label="Import projects from JSON file"
          />
          <label htmlFor="import-projects">
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                Import
              </span>
            </Button>
          </label>
          <Button variant="outline" size="sm" onClick={exportAllProjects}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Export All
          </Button>
        </div>
      </div>

      {/* Storage Info Alert */}
      <Alert>
        <Database className="h-4 w-4" aria-hidden="true" />
        <AlertDescription>
          <strong>Local Storage:</strong> Projects are saved in your browser&apos;s local storage.
          Data persists across sessions but is specific to this browser. Use Export to create
          backups.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Projects List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Projects</CardTitle>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    New
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                    <DialogDescription>
                      Create a new project to organize your networking configurations
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="project-name">Project Name</Label>
                      <Input
                        id="project-name"
                        placeholder="e.g., Office Network Redesign"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="project-description">Description</Label>
                      <Textarea
                        id="project-description"
                        placeholder="Brief description of the project..."
                        value={newProjectDescription}
                        onChange={(e) => setNewProjectDescription(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="project-tags">Tags (comma-separated)</Label>
                      <Input
                        id="project-tags"
                        placeholder="e.g., production, datacenter, vpn"
                        value={newProjectTags}
                        onChange={(e) => setNewProjectTags(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={createProject}>Create Project</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <CardDescription>
              {projects.length} project{projects.length !== 1 ? "s" : ""} saved
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {projects.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center justify-center py-8 text-center">
                  <FolderPlus className="mb-2 h-12 w-12 opacity-50" aria-hidden="true" />
                  <p className="text-sm">No projects yet</p>
                  <p className="text-xs">Create a new project to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                        selectedProject?.id === project.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedProject(project)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setSelectedProject(project)}
                      aria-label={`Select project: ${project.name}`}
                      aria-pressed={selectedProject?.id === project.id}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{project.name}</h4>
                        <Badge variant="secondary" className="text-xs">
                          {project.items.length} items
                        </Badge>
                      </div>
                      {project.description && (
                        <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                          {project.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center space-x-2">
                        <Clock className="text-muted-foreground h-3 w-3" aria-hidden="true" />
                        <span className="text-muted-foreground text-xs">
                          {formatDate(project.updatedAt)}
                        </span>
                      </div>
                      {project.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {project.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {project.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{project.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Project Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {selectedProject ? selectedProject.name : "Project Details"}
                </CardTitle>
                <CardDescription>
                  {selectedProject
                    ? selectedProject.description || "No description"
                    : "Select a project to view details"}
                </CardDescription>
              </div>
              {selectedProject && (
                <div className="flex items-center space-x-2">
                  <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                        Add Item
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Item to Project</DialogTitle>
                        <DialogDescription>
                          Add a networking configuration or calculation result to this project
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="item-name">Item Name</Label>
                          <Input
                            id="item-name"
                            placeholder="e.g., Office Subnet Plan"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="item-type">Type</Label>
                          <select
                            id="item-type"
                            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                            value={newItemType}
                            onChange={(e) => setNewItemType(e.target.value as ProjectItem["type"])}
                          >
                            <option value="subnet">Subnet Calculation</option>
                            <option value="vlsm">VLSM Plan</option>
                            <option value="vlan">VLAN Configuration</option>
                            <option value="acl">Access Control List</option>
                            <option value="dns">DNS Query</option>
                            <option value="route">Routing Configuration</option>
                            <option value="mtu">MTU Calculation</option>
                            <option value="ipv6">IPv6 Configuration</option>
                            <option value="conflict">IP Conflict Analysis</option>
                            <option value="oui">OUI Lookup</option>
                            <option value="port-scan">Port Scan Result</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="item-data">Data (JSON or plain text)</Label>
                          <Textarea
                            id="item-data"
                            placeholder='{"network": "192.168.1.0/24", "hosts": 254}'
                            className="font-mono text-sm"
                            rows={6}
                            value={newItemData}
                            onChange={(e) => setNewItemData(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="item-notes">Notes (optional)</Label>
                          <Textarea
                            id="item-notes"
                            placeholder="Additional notes about this item..."
                            rows={2}
                            value={newItemNotes}
                            onChange={(e) => setNewItemNotes(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddItemDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={addItemToProject}>Add Item</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" onClick={openEditDialog}>
                        <Edit className="mr-2 h-4 w-4" aria-hidden="true" />
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Project</DialogTitle>
                        <DialogDescription>Update project details</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-project-name">Project Name</Label>
                          <Input
                            id="edit-project-name"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-project-description">Description</Label>
                          <Textarea
                            id="edit-project-description"
                            value={newProjectDescription}
                            onChange={(e) => setNewProjectDescription(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-project-tags">Tags (comma-separated)</Label>
                          <Input
                            id="edit-project-tags"
                            value={newProjectTags}
                            onChange={(e) => setNewProjectTags(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={updateProject}>Save Changes</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportProject(selectedProject)}
                  >
                    <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                    Export
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive">
                        <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete &quot;{selectedProject.name}&quot; and all
                          its items. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteProject(selectedProject.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedProject ? (
              <Tabs defaultValue="items" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="items">Items ({selectedProject.items.length})</TabsTrigger>
                  <TabsTrigger value="info">Project Info</TabsTrigger>
                </TabsList>

                <TabsContent value="items" className="mt-4">
                  <ScrollArea className="h-[350px]">
                    {selectedProject.items.length === 0 ? (
                      <div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
                        <FileText className="mb-2 h-12 w-12 opacity-50" aria-hidden="true" />
                        <p className="text-sm">No items in this project</p>
                        <p className="text-xs">Add items using the button above</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedProject.items.map((item) => {
                          const Icon = getItemIcon(item.type)
                          return (
                            <div key={item.id} className="bg-muted/50 rounded-lg p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="bg-primary/10 rounded-lg p-2">
                                    <Icon className="text-primary h-4 w-4" aria-hidden="true" />
                                  </div>
                                  <div>
                                    <h4 className="font-medium">{item.name}</h4>
                                    <div className="flex items-center space-x-2">
                                      <Badge variant="secondary" className="text-xs">
                                        {getItemTypeLabel(item.type)}
                                      </Badge>
                                      <span className="text-muted-foreground text-xs">
                                        {formatDate(item.createdAt)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      copyToClipboard(JSON.stringify(item.data, null, 2), item.id)
                                    }
                                    aria-label={`Copy ${item.name} data`}
                                  >
                                    {copiedField === item.id ? (
                                      <Check
                                        className="h-4 w-4 text-green-600"
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <Copy className="h-4 w-4" aria-hidden="true" />
                                    )}
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-destructive"
                                        aria-label={`Delete ${item.name}`}
                                      >
                                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Item?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will remove &quot;{item.name}&quot; from the project.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteItem(item.id)}>
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                              {item.notes && (
                                <p className="text-muted-foreground mt-2 text-sm">{item.notes}</p>
                              )}
                              {Object.keys(item.data).length > 0 && (
                                <div className="mt-3">
                                  <pre className="max-h-32 overflow-auto rounded bg-black/5 p-2 font-mono text-xs dark:bg-white/5">
                                    {JSON.stringify(item.data, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="info" className="mt-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted/50 rounded-lg p-4">
                        <p className="text-muted-foreground text-sm">Created</p>
                        <p className="font-medium">{formatDate(selectedProject.createdAt)}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4">
                        <p className="text-muted-foreground text-sm">Last Updated</p>
                        <p className="font-medium">{formatDate(selectedProject.updatedAt)}</p>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <p className="text-muted-foreground mb-2 text-sm">Tags</p>
                      {selectedProject.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedProject.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">No tags</p>
                      )}
                    </div>

                    <Separator />

                    <div>
                      <p className="text-muted-foreground mb-2 text-sm">Item Summary</p>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            "subnet",
                            "vlsm",
                            "vlan",
                            "acl",
                            "dns",
                            "route",
                            "mtu",
                            "ipv6",
                            "other",
                          ] as ProjectItem["type"][]
                        ).map((type) => {
                          const count = selectedProject.items.filter((i) => i.type === type).length
                          if (count === 0) return null
                          const Icon = getItemIcon(type)
                          return (
                            <div
                              key={type}
                              className="bg-muted/50 flex items-center gap-2 rounded p-2"
                            >
                              <Icon className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                              <span className="text-sm">
                                {count} {getItemTypeLabel(type)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-muted-foreground flex flex-col items-center justify-center py-16 text-center">
                <FolderOpen className="mb-4 h-16 w-16 opacity-50" aria-hidden="true" />
                <p>Select a project from the list</p>
                <p className="text-sm">or create a new one to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="bg-muted/50 rounded-lg p-4">
              <Save className="text-primary mb-2 h-5 w-5" aria-hidden="true" />
              <h4 className="font-medium">Save Your Work</h4>
              <p className="text-muted-foreground text-sm">
                Copy results from any tool and add them as items to your projects for future
                reference.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <Download className="text-primary mb-2 h-5 w-5" aria-hidden="true" />
              <h4 className="font-medium">Export & Share</h4>
              <p className="text-muted-foreground text-sm">
                Export projects as JSON files to share with colleagues or back up your
                configurations.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <Upload className="text-primary mb-2 h-5 w-5" aria-hidden="true" />
              <h4 className="font-medium">Import Projects</h4>
              <p className="text-muted-foreground text-sm">
                Import previously exported projects or receive shared configurations from others.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
