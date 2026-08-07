"use client"

import { useCallback, useState, type ReactNode } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { copyText } from "@/lib/clipboard"
import { cn } from "@/lib/utils"

export interface ReferenceColumn<T> {
  key: string
  header: string
  headClassName?: string
  cellClassName?: string
  // the string a search matches on and the copy button copies
  text: (row: T) => string
  cell?: (row: T) => ReactNode
  // set to add an icon-only copy button; icon-only needs a per-row name
  copyLabel?: (row: T) => string
}

interface ReferenceTableProps<T> {
  title: string
  description?: ReactNode
  rows: readonly T[]
  columns: readonly ReferenceColumn<T>[]
  rowKey: (row: T) => string
  emptyMessage?: string
  // a tailwind height class caps the table and scrolls inside it
  maxHeight?: string
}

// rows are searched on the same strings the table renders, so anything visible
// is findable
export function searchableText<T>(columns: readonly ReferenceColumn<T>[], row: T): string[] {
  return columns.map((column) => column.text(row))
}

// CopyButton's silent behaviour with a per-row name: a table of 33 rows would
// otherwise put 33 buttons called "Copy to clipboard" in the tab order
function RowCopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!(await copyText(value))) return
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [value])

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("transition-all duration-200", copied && "text-green-600 dark:text-green-400")}
      onClick={handleCopy}
      aria-label={copied ? "Copied!" : label}
    >
      {copied ? (
        <Check className="h-3 w-3" aria-hidden="true" />
      ) : (
        <Copy className="h-3 w-3" aria-hidden="true" />
      )}
    </Button>
  )
}

export function ReferenceTable<T>({
  title,
  description,
  rows,
  columns,
  rowKey,
  emptyMessage = "No rows match your search",
  maxHeight,
}: ReferenceTableProps<T>) {
  const table = (
    <Table aria-label={title}>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.key} className={column.headClassName}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={columns.length}
              className="text-muted-foreground py-8 text-center text-sm"
            >
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={rowKey(row)}>
              {columns.map((column) => {
                const content = column.cell ? column.cell(row) : column.text(row)
                return (
                  <TableCell key={column.key} className={column.cellClassName}>
                    {column.copyLabel ? (
                      <div className="flex items-center gap-1">
                        {content}
                        <RowCopyButton value={column.text(row)} label={column.copyLabel(row)} />
                      </div>
                    ) : (
                      content
                    )}
                  </TableCell>
                )
              })}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description !== undefined && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {maxHeight ? <ScrollArea className={maxHeight}>{table}</ScrollArea> : table}
      </CardContent>
    </Card>
  )
}
