"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Network, Layers, TrendingUp, Shield, ArrowRight } from "lucide-react"
import { tools, categories, getPopularTools, type ToolDefinition } from "@/lib/tool-registry"

interface DashboardProps {
  onNavigate: (view: string) => void
}

// Get featured tools (popular ones) for the dashboard
const featuredTools = getPopularTools()

// Calculate stats from registry
const stats = [
  {
    title: "Available Tools",
    value: tools.length.toString(),
    description: "Professional utilities",
    icon: Network,
  },
  {
    title: "Categories",
    value: categories.length.toString(),
    description: "Organized categories",
    icon: Layers,
  },
  {
    title: "Popular Tools",
    value: featuredTools.length.toString(),
    description: "Most frequently used",
    icon: TrendingUp,
  },
  {
    title: "Offline Ready",
    value: "100%",
    description: "Works without internet",
    icon: Shield,
  },
]

function ToolCard({
  tool,
  onNavigate,
}: {
  tool: ToolDefinition
  onNavigate: (view: string) => void
}) {
  const Icon = tool.icon
  return (
    <Card
      className={`group border-border hover:border-primary/30 cursor-pointer transition-all duration-200 hover:shadow-lg ${
        tool.popular ? "ring-primary/20 from-card to-primary/5 bg-gradient-to-br ring-2" : ""
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110 sm:h-12 sm:w-12 ${
                tool.popular ? "bg-primary/20" : "bg-primary/10"
              } group-hover:bg-primary/30`}
              aria-hidden="true"
            >
              <Icon className="text-primary h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col space-y-1 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2">
                <CardTitle className="text-base leading-tight sm:text-lg">{tool.title}</CardTitle>
                {tool.popular && (
                  <Badge
                    variant="default"
                    className="bg-primary text-primary-foreground border-primary w-fit text-xs"
                  >
                    Popular
                  </Badge>
                )}
              </div>
              <Badge variant="secondary" className="mt-1 w-fit text-xs">
                {tool.categoryLabel}
              </Badge>
            </div>
          </div>
        </div>
        <CardDescription className="mt-2 text-sm leading-relaxed">
          {tool.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-wrap gap-1">
            {tool.features.map((feature, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {feature}
              </Badge>
            ))}
          </div>
          <Button
            onClick={() => onNavigate(tool.id)}
            className="hover:bg-primary hover:text-primary-foreground group-hover:bg-primary group-hover:text-primary-foreground w-full transition-colors"
            variant="outline"
            aria-label={`Launch ${tool.title}`}
          >
            Launch Tool
            <ArrowRight
              className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function Dashboard({ onNavigate }: DashboardProps) {
  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-3">
          <div
            className="bg-primary flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12"
            aria-hidden="true"
          >
            <Network className="text-primary-foreground h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-balance sm:text-3xl lg:text-4xl">
              Network & Developer Toolbox
            </h1>
            <p className="text-muted-foreground text-sm text-pretty sm:text-base lg:text-lg">
              Professional tools for network engineers, developers, and IT professionals
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index} className="from-card to-muted/20 bg-gradient-to-br">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-xs font-medium sm:text-sm">
                      {stat.title}
                    </p>
                    <p className="text-primary text-xl font-bold sm:text-2xl">{stat.value}</p>
                    <p className="text-muted-foreground mt-1 hidden text-xs sm:block">
                      {stat.description}
                    </p>
                  </div>
                  <div
                    className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg sm:h-10 sm:w-10"
                    aria-hidden="true"
                  >
                    <Icon className="text-primary h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <h2 className="text-xl font-semibold sm:text-2xl">Popular Tools</h2>
          <Badge variant="secondary" className="w-fit text-sm">
            {featuredTools.length} featured / {tools.length} total
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {featuredTools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} onNavigate={onNavigate} />
          ))}
        </div>
      </div>

      {/* Category quick access */}
      <Card>
        <CardHeader>
          <CardTitle>Browse by Category</CardTitle>
          <CardDescription>All {tools.length} tools organized by function</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((category) => {
              const Icon = category.icon
              const categoryTools = tools.filter((t) => t.category === category.id)
              return (
                <button
                  key={category.id}
                  onClick={() => {
                    // Navigate to first tool in category as a quick access
                    if (categoryTools.length > 0) {
                      onNavigate(categoryTools[0].id)
                    }
                  }}
                  className="hover:bg-muted/50 hover:border-primary/30 flex items-center gap-3 rounded-lg border p-3 text-left transition-colors"
                >
                  <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                    <Icon className="text-primary h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{category.label}</p>
                    <p className="text-muted-foreground text-xs">{categoryTools.length} tools</p>
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="from-primary/10 via-secondary/5 to-accent/10 border-primary/30 bg-gradient-to-r">
        <CardHeader>
          <CardTitle className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-3">
            <div
              className="bg-primary/20 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
              aria-hidden="true"
            >
              <Shield className="text-primary h-5 w-5" />
            </div>
            <div>
              <span className="text-lg sm:text-xl">Privacy & Security First</span>
              <p className="text-muted-foreground mt-1 text-sm font-normal">
                Built with privacy and security as core principles
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            <div className="flex items-start space-x-3">
              <div className="mt-1 h-3 w-3 flex-shrink-0 rounded-full bg-emerald-500"></div>
              <div>
                <h4 className="text-sm font-medium">No Telemetry</h4>
                <p className="text-muted-foreground mt-1 text-xs">
                  Zero tracking or data collection
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="mt-1 h-3 w-3 flex-shrink-0 rounded-full bg-emerald-500"></div>
              <div>
                <h4 className="text-sm font-medium">Offline First</h4>
                <p className="text-muted-foreground mt-1 text-xs">
                  Works completely offline by default
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="mt-1 h-3 w-3 flex-shrink-0 rounded-full bg-emerald-500"></div>
              <div>
                <h4 className="text-sm font-medium">WCAG Compliant</h4>
                <p className="text-muted-foreground mt-1 text-xs">
                  Accessible to all users (AA standard)
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
