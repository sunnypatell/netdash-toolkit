"use client"

import { useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  FolderOpen,
  Plus,
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
  Cloud,
  CloudOff,
  Loader2,
  Wifi,
  Share2,
  Users,
  Eye,
  Crown,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  useProjects,
  type ProjectItem,
  type Project,
  type SharedProject,
} from "@/contexts/project-context"
import { useAuth } from "@/contexts/auth-context"
import { ShareProjectDialog } from "@/components/ui/share-project-dialog"

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
    routing: Network,
    mtu: Calculator,
    ipv6: Network,
    conflict: AlertCircle,
    oui: Search,
    "port-scan": Shield,
    wireless: Wifi,
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
    routing: "Routing Configuration",
    mtu: "MTU Calculation",
    ipv6: "IPv6 Configuration",
    conflict: "IP Conflict Analysis",
    oui: "OUI Lookup",
    "port-scan": "Port Scan Result",
    wireless: "Wireless Configuration",
    other: "Other",
  }
  return labels[type] || "Other"
}

export function ProjectManager() {
  const { toast } = useToast()
  const {
    projects,
    sharedProjects,
    loading,
    syncing,
    syncEnabled,
    addProject,
    updateProject,
    deleteProject,
    addItemToProject,
    removeItemFromProject,
    exportProject,
    exportAllProjects,
    importProjects,
    isProjectOwner,
    canEditProject,
  } = useProjects()
  const { user, isConfigured, signInWithGoogle } = useAuth()

  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedSharedProject, setSelectedSharedProject] = useState<SharedProject | null>(null)
  const [projectsTab, setProjectsTab] = useState<"my" | "shared">("my")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false)
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Form states
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDescription, setNewProjectDescription] = useState("")
  const [newProjectTags, setNewProjectTags] = useState("")

  const [newItemName, setNewItemName] = useState("")
  const [newItemType, setNewItemType] = useState<ProjectItem["type"]>("other")
  const [newItemData, setNewItemData] = useState("")
  const [newItemNotes, setNewItemNotes] = useState("")

  // Update selected project when projects change
  const currentProject = selectedProject
    ? projects.find((p) => p.id === selectedProject.id) || null
    : null

  // Update selected shared project when shared projects change
  const currentSharedProject = selectedSharedProject
    ? sharedProjects.find((p) => p.id === selectedSharedProject.id) || null
    : null

  // Get the active project (either own or shared)
  const activeProject = projectsTab === "my" ? currentProject : currentSharedProject
  const canEdit = activeProject ? canEditProject(activeProject) : false
  const isOwner = activeProject ? isProjectOwner(activeProject) : false

  // Create a new project
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a project name",
        variant: "destructive",
      })
      return
    }

    const newProject = await addProject({
      name: newProjectName.trim(),
      description: newProjectDescription.trim(),
      items: [],
      tags: newProjectTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    })

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
  const handleUpdateProject = async () => {
    if (!currentProject || !newProjectName.trim()) return

    await updateProject(currentProject.id, {
      name: newProjectName.trim(),
      description: newProjectDescription.trim(),
      tags: newProjectTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    })

    setIsEditDialogOpen(false)

    toast({
      title: "Project updated",
      description: "Project details have been saved",
    })
  }

  // Delete a project
  const handleDeleteProject = async (id: string) => {
    await deleteProject(id)
    if (selectedProject?.id === id) {
      setSelectedProject(null)
    }

    toast({
      title: "Project deleted",
      description: "Project has been removed",
    })
  }

  // Add item to project
  const handleAddItem = async () => {
    if (!currentProject || !newItemName.trim()) {
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
        parsedData = { raw: newItemData }
      }
    }

    await addItemToProject(currentProject.id, {
      type: newItemType,
      name: newItemName.trim(),
      data: parsedData,
      notes: newItemNotes.trim() || undefined,
    })

    setNewItemName("")
    setNewItemType("other")
    setNewItemData("")
    setNewItemNotes("")
    setIsAddItemDialogOpen(false)

    toast({
      title: "Item added",
      description: "Configuration has been saved to project",
    })
  }

  // Remove item from project
  const handleRemoveItem = async (itemId: string) => {
    if (!currentProject) return

    await removeItemFromProject(currentProject.id, itemId)

    toast({
      title: "Item removed",
      description: "Configuration has been removed from project",
    })
  }

  // Handle file import
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const count = await importProjects(text)

      toast({
        title: "Import successful",
        description: `Imported ${count} project(s)`,
      })
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Invalid file format",
        variant: "destructive",
      })
    }

    e.target.value = ""
  }

  // Copy to clipboard
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  // Open edit dialog with current values
  const openEditDialog = () => {
    if (!currentProject) return
    setNewProjectName(currentProject.name)
    setNewProjectDescription(currentProject.description)
    setNewProjectTags(currentProject.tags.join(", "))
    setIsEditDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FolderOpen className="text-primary h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold">Project Manager</h1>
            <p className="text-muted-foreground text-sm">
              Organize and save your network configurations
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {syncEnabled ? (
            <Badge variant="outline" className="text-green-600">
              <Cloud className="mr-1 h-3 w-3" />
              {syncing ? "Syncing..." : "Cloud Sync"}
            </Badge>
          ) : isConfigured ? (
            <Button variant="outline" size="sm" onClick={signInWithGoogle}>
              <Cloud className="mr-2 h-4 w-4" />
              Enable Cloud Sync
            </Button>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              <CloudOff className="mr-1 h-3 w-3" />
              Local Storage
            </Badge>
          )}
        </div>
      </div>

      {/* Cloud Sync Info */}
      {!syncEnabled && isConfigured && !user && (
        <Alert>
          <Cloud className="h-4 w-4" />
          <AlertDescription>
            Sign in with your Google account to sync your projects across devices. Your data will be
            securely stored in the cloud and accessible from anywhere.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Projects List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Projects</CardTitle>
              {projectsTab === "my" && (
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      New
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Project</DialogTitle>
                      <DialogDescription>
                        Create a new project to organize your network configurations.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="project-name">Project Name</Label>
                        <Input
                          id="project-name"
                          placeholder="My Network Project"
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="project-description">Description</Label>
                        <Textarea
                          id="project-description"
                          placeholder="Project description..."
                          value={newProjectDescription}
                          onChange={(e) => setNewProjectDescription(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="project-tags">Tags (comma-separated)</Label>
                        <Input
                          id="project-tags"
                          placeholder="network, datacenter, production"
                          value={newProjectTags}
                          onChange={(e) => setNewProjectTags(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateProject}>Create Project</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Tabs for My Projects vs Shared */}
            {sharedProjects.length > 0 || syncEnabled ? (
              <Tabs
                value={projectsTab}
                onValueChange={(v) => setProjectsTab(v as "my" | "shared")}
                className="mb-4"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="my" className="gap-1">
                    <Crown className="h-3 w-3" />
                    My Projects ({projects.length})
                  </TabsTrigger>
                  <TabsTrigger value="shared" className="gap-1">
                    <Users className="h-3 w-3" />
                    Shared ({sharedProjects.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            ) : null}

            <ScrollArea className="h-[350px]">
              {projectsTab === "my" ? (
                projects.length === 0 ? (
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
                          currentProject?.id === project.id
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => {
                          setSelectedProject(project)
                          setSelectedSharedProject(null)
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && setSelectedProject(project)}
                        aria-label={`Select project: ${project.name}`}
                        aria-pressed={currentProject?.id === project.id}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{project.name}</h4>
                          <div className="flex items-center gap-2">
                            {project.isShared && (
                              <Badge variant="outline" className="gap-1 text-xs">
                                <Share2 className="h-3 w-3" />
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              {project.items.length} items
                            </Badge>
                          </div>
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
                      </div>
                    ))}
                  </div>
                )
              ) : // Shared projects tab
              sharedProjects.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center justify-center py-8 text-center">
                  <Users className="mb-2 h-12 w-12 opacity-50" aria-hidden="true" />
                  <p className="text-sm">No shared projects</p>
                  <p className="text-xs">Projects shared with you will appear here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sharedProjects.map((project) => (
                    <div
                      key={project.id}
                      className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                        currentSharedProject?.id === project.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        setSelectedSharedProject(project)
                        setSelectedProject(null)
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setSelectedSharedProject(project)}
                      aria-label={`Select shared project: ${project.name}`}
                      aria-pressed={currentSharedProject?.id === project.id}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{project.name}</h4>
                        <Badge
                          variant={project.permission === "view" ? "secondary" : "default"}
                          className="gap-1 text-xs"
                        >
                          {project.permission === "view" ? (
                            <Eye className="h-3 w-3" />
                          ) : project.permission === "edit" ? (
                            <Edit className="h-3 w-3" />
                          ) : (
                            <Shield className="h-3 w-3" />
                          )}
                          {project.permission}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Shared by {project.ownerEmail}
                      </p>
                      {project.description && (
                        <p className="text-muted-foreground mt-1 line-clamp-1 text-sm">
                          {project.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center space-x-2">
                        <Clock className="text-muted-foreground h-3 w-3" aria-hidden="true" />
                        <span className="text-muted-foreground text-xs">
                          {formatDate(project.updatedAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <Separator className="my-4" />

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={exportAllProjects}
                disabled={projects.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Export All
              </Button>
              <label htmlFor="import-projects">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    Import
                  </span>
                </Button>
              </label>
              <input
                type="file"
                id="import-projects"
                accept=".json"
                className="sr-only"
                onChange={handleImport}
              />
            </div>
          </CardContent>
        </Card>

        {/* Project Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>{activeProject?.name || "Select a Project"}</CardTitle>
                  {currentSharedProject && (
                    <Badge variant="outline" className="gap-1">
                      {currentSharedProject.permission === "view" ? (
                        <Eye className="h-3 w-3" />
                      ) : currentSharedProject.permission === "edit" ? (
                        <Edit className="h-3 w-3" />
                      ) : (
                        <Shield className="h-3 w-3" />
                      )}
                      {currentSharedProject.permission}
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  {currentSharedProject
                    ? `Shared by ${currentSharedProject.ownerEmail}`
                    : activeProject?.description || "Choose a project to view its contents"}
                </CardDescription>
              </div>
              {activeProject && (
                <div className="flex items-center space-x-2">
                  {/* Share button - only for owned projects */}
                  {isOwner && syncEnabled && (
                    <Button size="sm" variant="outline" onClick={() => setIsShareDialogOpen(true)}>
                      <Share2 className="mr-2 h-4 w-4" />
                      Share
                    </Button>
                  )}

                  {/* Edit button - for owners and those with edit permission */}
                  {canEdit && projectsTab === "my" && (
                    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" onClick={openEditDialog}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Project</DialogTitle>
                          <DialogDescription>Update project details.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="edit-name">Project Name</Label>
                            <Input
                              id="edit-name"
                              value={newProjectName}
                              onChange={(e) => setNewProjectName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-description">Description</Label>
                            <Textarea
                              id="edit-description"
                              value={newProjectDescription}
                              onChange={(e) => setNewProjectDescription(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
                            <Input
                              id="edit-tags"
                              value={newProjectTags}
                              onChange={(e) => setNewProjectTags(e.target.value)}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleUpdateProject}>Save Changes</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}

                  {/* Export - available for owners */}
                  {isOwner && currentProject && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportProject(currentProject)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  )}

                  {/* Delete - only for owners */}
                  {isOwner && currentProject && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete &quot;{currentProject.name}&quot; and all
                            its items. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteProject(currentProject.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {activeProject ? (
              <Tabs defaultValue="items" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="items">Items ({activeProject.items.length})</TabsTrigger>
                  <TabsTrigger value="info">Project Info</TabsTrigger>
                </TabsList>

                <TabsContent value="items" className="mt-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-muted-foreground text-sm">
                      {!canEdit && currentSharedProject
                        ? "View-only access"
                        : "Saved configurations and results"}
                    </p>
                    {canEdit && (
                      <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Item
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Configuration Item</DialogTitle>
                            <DialogDescription>
                              Add a new configuration or result to this project.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="item-name">Item Name</Label>
                              <Input
                                id="item-name"
                                placeholder="My Subnet Calculation"
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="item-type">Type</Label>
                              <Select
                                value={newItemType}
                                onValueChange={(v) => setNewItemType(v as ProjectItem["type"])}
                              >
                                <SelectTrigger id="item-type">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="subnet">Subnet Calculation</SelectItem>
                                  <SelectItem value="vlsm">VLSM Plan</SelectItem>
                                  <SelectItem value="vlan">VLAN Configuration</SelectItem>
                                  <SelectItem value="acl">Access Control List</SelectItem>
                                  <SelectItem value="dns">DNS Query</SelectItem>
                                  <SelectItem value="route">Routing Configuration</SelectItem>
                                  <SelectItem value="mtu">MTU Calculation</SelectItem>
                                  <SelectItem value="ipv6">IPv6 Configuration</SelectItem>
                                  <SelectItem value="conflict">IP Conflict Analysis</SelectItem>
                                  <SelectItem value="oui">OUI Lookup</SelectItem>
                                  <SelectItem value="port-scan">Port Scan Result</SelectItem>
                                  <SelectItem value="wireless">Wireless Configuration</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="item-data">Data (JSON or plain text)</Label>
                              <Textarea
                                id="item-data"
                                placeholder='{"network": "192.168.1.0/24"}'
                                className="min-h-[100px] font-mono"
                                value={newItemData}
                                onChange={(e) => setNewItemData(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="item-notes">Notes (optional)</Label>
                              <Textarea
                                id="item-notes"
                                placeholder="Additional notes..."
                                value={newItemNotes}
                                onChange={(e) => setNewItemNotes(e.target.value)}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddItemDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleAddItem}>Add Item</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>

                  <ScrollArea className="h-[350px]">
                    {activeProject.items.length === 0 ? (
                      <div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
                        <FileText className="mb-2 h-12 w-12 opacity-50" aria-hidden="true" />
                        <p className="text-sm">No items in this project</p>
                        <p className="text-xs">
                          Add configurations from tools or manually add items
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activeProject.items.map((item) => {
                          const Icon = getItemIcon(item.type)
                          return (
                            <div key={item.id} className="bg-muted/50 rounded-lg border p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-3">
                                  <Icon className="text-primary h-5 w-5" aria-hidden="true" />
                                  <div>
                                    <h4 className="font-medium">{item.name}</h4>
                                    <Badge variant="outline" className="mt-1 text-xs">
                                      {getItemTypeLabel(item.type)}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
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
                                      >
                                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Item?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Remove &quot;{item.name}&quot; from this project?
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleRemoveItem(item.id)}
                                        >
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
                              {item.toolSource && (
                                <p className="text-muted-foreground mt-1 text-xs">
                                  Source: {item.toolSource}
                                </p>
                              )}
                              <p className="text-muted-foreground mt-2 text-xs">
                                <Clock className="mr-1 inline h-3 w-3" />
                                {formatDate(item.createdAt)}
                              </p>
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
                      <div>
                        <Label className="text-muted-foreground text-sm">Created</Label>
                        <p className="font-medium">{formatDate(activeProject.createdAt)}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-sm">Last Updated</Label>
                        <p className="font-medium">{formatDate(activeProject.updatedAt)}</p>
                      </div>
                    </div>

                    {activeProject.tags.length > 0 && (
                      <div>
                        <Label className="text-muted-foreground text-sm">Tags</Label>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {activeProject.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <Separator />

                    <div>
                      <Label className="text-muted-foreground text-sm">Item Breakdown</Label>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {(
                          [
                            "subnet",
                            "vlsm",
                            "vlan",
                            "acl",
                            "dns",
                            "route",
                            "mtu",
                            "conflict",
                            "oui",
                            "port-scan",
                            "wireless",
                            "ipv6",
                            "other",
                          ] as ProjectItem["type"][]
                        ).map((type) => {
                          const count = activeProject.items.filter((i) => i.type === type).length
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
              <div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
                <FolderOpen className="mb-4 h-16 w-16 opacity-50" aria-hidden="true" />
                <p className="text-lg font-medium">No Project Selected</p>
                <p className="text-sm">
                  Select a project from the list or create a new one to get started
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Share Project Dialog */}
      {currentProject && (
        <ShareProjectDialog
          project={currentProject}
          open={isShareDialogOpen}
          onOpenChange={setIsShareDialogOpen}
        />
      )}
    </div>
  )
}
