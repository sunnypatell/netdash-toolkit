"use client"

import { useMemo } from "react"
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Server, Search } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { DataTable, searchableText, type DataColumn } from "@/components/tools/reference-table"
import { filterRows } from "@/lib/reference/search"
import {
  CATEGORIZED_PORTS,
  PORT_CATEGORY_LABELS,
  PORT_RANGES,
  type CategorizedPortEntry,
  type PortCategory,
} from "@/lib/reference/service-ports"

const CATEGORY_VALUES = ["all", ...(Object.keys(PORT_CATEGORY_LABELS) as PortCategory[])] as const

const columns: DataColumn<CategorizedPortEntry>[] = [
  {
    key: "port",
    header: "Port",
    headerClassName: "w-24 p-2 text-left font-medium",
    text: (row) => String(row.port),
    cell: (row) => (
      <Badge variant="secondary" className="font-mono">
        {row.port}
      </Badge>
    ),
    copyable: true,
  },
  {
    key: "protocol",
    header: "Transport",
    headerClassName: "w-28 p-2 text-left font-medium",
    text: (row) => row.protocol,
    cell: (row) => <Badge variant="outline">{row.protocol}</Badge>,
  },
  {
    key: "service",
    header: "Service",
    cellClassName: "p-2 font-medium",
    text: (row) => row.service,
  },
  {
    key: "iana",
    header: "IANA Name",
    cellClassName: "text-muted-foreground p-2 font-mono text-xs",
    text: (row) => row.ianaName,
  },
  {
    key: "description",
    header: "Description",
    cellClassName: "text-muted-foreground p-2",
    text: (row) => row.description,
  },
]

function categoryLabel(category: (typeof CATEGORY_VALUES)[number]): string {
  return category === "all" ? "All Ports" : PORT_CATEGORY_LABELS[category]
}

export function PortReference() {
  const [query, setQuery] = useQueryStates(
    {
      category: parseAsStringLiteral(CATEGORY_VALUES).withDefault("all"),
      q: parseAsString.withDefault(""),
    },
    // typing should not fill the back button with one entry per keystroke
    { history: "replace" }
  )

  const { category, q } = query

  const rows = useMemo(() => {
    const inCategory =
      category === "all"
        ? CATEGORIZED_PORTS
        : CATEGORIZED_PORTS.filter((entry) => entry.category === category)
    return filterRows(inCategory, q, (row) => searchableText(columns, row))
  }, [category, q])

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Server}
        title="Port Reference"
        description="Common network ports with their registered IANA service names"
      />

      <Tabs
        value={category}
        onValueChange={(value) => setQuery({ category: value as (typeof CATEGORY_VALUES)[number] })}
        className="gap-4 sm:gap-6"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" aria-hidden="true" />
              Search Ports
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="port-search">Search by port number or service</Label>
              <Input
                id="port-search"
                value={q}
                onChange={(e) => setQuery({ q: e.target.value })}
                placeholder="80, HTTPS, database..."
                className="max-w-md"
              />
            </div>

            <TabsList aria-label="Filter ports by category" className="h-auto flex-wrap">
              {CATEGORY_VALUES.map((value) => (
                <TabsTrigger key={value} value={value}>
                  {categoryLabel(value)}
                </TabsTrigger>
              ))}
            </TabsList>
          </CardContent>
        </Card>

        {/* the filtered table is the panel the selected category tab controls */}
        <TabsContent value={category}>
          <DataTable
            title={`${rows.length} Port${rows.length === 1 ? "" : "s"} Found`}
            description={categoryLabel(category)}
            rows={rows}
            columns={columns}
            rowKey={(row) => `${row.port}-${row.protocol}`}
            emptyMessage="No ports match your search"
          />
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Port Ranges (RFC 6335 section 6)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {PORT_RANGES.map((range) => (
              <div key={range.name} className="rounded-lg border p-4">
                <Badge className="mb-2 font-mono">
                  {range.start}-{range.end}
                </Badge>
                <h4 className="font-semibold">{range.name}</h4>
                <p className="text-muted-foreground text-xs">also called {range.alias}</p>
                <p className="text-muted-foreground mt-2 text-sm">{range.assignment}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
