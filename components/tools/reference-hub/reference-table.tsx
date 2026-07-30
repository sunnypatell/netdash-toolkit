"use client"

import type { ReactNode } from "react"
import { Copy } from "lucide-react"
import { toast } from "sonner"
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
  description: string
  rows: readonly T[]
  columns: readonly ReferenceColumn<T>[]
  rowKey: (row: T) => string
  emptyMessage?: string
}

async function copyValue(value: string) {
  if (await copyText(value)) {
    toast.success("Copied to clipboard")
  } else {
    toast.error("Copy failed")
  }
}

export function ReferenceTable<T>({
  title,
  description,
  rows,
  columns,
  rowKey,
  emptyMessage = "No rows match your search",
}: ReferenceTableProps<T>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {description} ({rows.length} shown)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
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
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyValue(column.text(row))}
                                aria-label={column.copyLabel(row)}
                              >
                                <Copy className="h-3 w-3" aria-hidden="true" />
                              </Button>
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
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
