"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { RuntimeBadge } from "@/components/ui/runtime-badge"
import { Network, Layers, TrendingUp, Shield, ArrowRight, Search } from "lucide-react"
import {
  categories,
  offlineToolCount,
  categoryLabelOf,
  getPopularTools,
  getToolsByCategory,
  searchTools,
  tools,
  type ToolDefinition,
} from "@/lib/tool-registry"

const featuredTools = getPopularTools()

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
    title: "Fully Offline",
    // computed, never hardcoded: this tile claimed 100% while 12 tools did
    // network i/o, and a registry invariant test now keeps it honest
    value: `${offlineToolCount()}/${tools.length}`,
    description: "Never leave your device",
    icon: Shield,
  },
]

function ToolCard({ tool }: { tool: ToolDefinition }) {
  const Icon = tool.icon
  return (
    <Card
      className={`group border-border hover:border-primary/30 transition-all duration-200 hover:shadow-lg ${
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
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <Badge variant="secondary" className="w-fit text-xs">
                  {categoryLabelOf(tool)}
                </Badge>
                <RuntimeBadge tool={tool} />
              </div>
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
            asChild
            className="hover:bg-primary hover:text-primary-foreground group-hover:bg-primary group-hover:text-primary-foreground w-full transition-colors"
            variant="outline"
          >
            <Link href={`/tools/${tool.slug}`} aria-label={`Launch ${tool.title}`}>
              Launch Tool
              <ArrowRight
                className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function Dashboard() {
  const [query, setQuery] = useState("")
  // registry keywords finally drive something: live search over all tools
  const results = useMemo(() => searchTools(query), [query])
  const searching = query.trim().length > 0

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

        <div className="relative max-w-xl">
          <Search
            className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${tools.length} tools by name or keyword...`}
            className="pl-9"
            aria-label="Search tools"
          />
        </div>
      </div>

      {searching ? (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold sm:text-2xl">Search Results</h2>
            <Badge variant="secondary" className="w-fit text-sm">
              {results.length} {results.length === 1 ? "match" : "matches"}
            </Badge>
          </div>
          {results.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3">
              {results.map((tool) => (
                <ToolCard key={tool.slug} tool={tool} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No tools match &quot;{query}&quot;. Try a different keyword.
            </p>
          )}
        </div>
      ) : (
        <>
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
                <ToolCard key={tool.slug} tool={tool} />
              ))}
            </div>
          </div>

          {/* category quick access */}
          <Card>
            <CardHeader>
              <CardTitle>Browse by Category</CardTitle>
              <CardDescription>All {tools.length} tools organized by function</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {categories.map((category) => {
                  const Icon = category.icon
                  const categoryTools = getToolsByCategory(category.id)
                  const first = categoryTools[0]
                  if (!first) return null
                  return (
                    <Link
                      key={category.id}
                      href={`/tools/${first.slug}`}
                      className="hover:bg-muted/50 hover:border-primary/30 flex items-center gap-3 rounded-lg border p-3 text-left transition-colors"
                    >
                      <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                        <Icon className="text-primary h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{category.label}</p>
                        <p className="text-muted-foreground text-xs">
                          {categoryTools.length} tools
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
