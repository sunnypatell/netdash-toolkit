"use client"

import type { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CopyButton } from "@/components/ui/copy-button"

export interface DataColumn<T> {
  key: string
  header: string
  headerClassName?: string
  cellClassName?: string
  // the searchable string for the cell; also what the copy button copies
  text: (row: T) => string
  cell?: (row: T) => ReactNode
  copyable?: boolean
}

interface DataTableProps<T> {
  title: string
  description?: string
  rows: readonly T[]
  columns: readonly DataColumn<T>[]
  rowKey: (row: T) => string
  emptyMessage?: string
}

export function searchableText<T>(columns: readonly DataColumn<T>[], row: T): string[] {
  return columns.map((column) => column.text(row))
}

export function DataTable<T>({
  title,
  description,
  rows,
  columns,
  rowKey,
  emptyMessage = "No rows match your search",
}: DataTableProps<T>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={column.headerClassName ?? "p-2 text-left font-medium"}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowKey(row)} className="hover:bg-muted/50 border-b">
                  {columns.map((column) => (
                    <td key={column.key} className={column.cellClassName ?? "p-2"}>
                      {column.copyable ? (
                        <span className="flex items-center gap-1">
                          {column.cell ? column.cell(row) : column.text(row)}
                          <CopyButton value={column.text(row)} size="sm" />
                        </span>
                      ) : column.cell ? (
                        column.cell(row)
                      ) : (
                        column.text(row)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <p className="text-muted-foreground py-8 text-center">{emptyMessage}</p>
        )}
      </CardContent>
    </Card>
  )
}
