"use client"

import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle, Plus, Trash2 } from "lucide-react"
import type { ValidationResult } from "@/lib/acl"

interface RulesCardProps {
  count: number
  onAdd: () => void
  children: ReactNode
}

export function RulesCard({ count, onAdd, children }: RulesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Rules
          <div className="flex space-x-2">
            <Badge variant="secondary">{count} rules</Badge>
            <Button onClick={onAdd} size="sm">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Add Rule
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 space-y-4 overflow-y-auto">{children}</div>
      </CardContent>
    </Card>
  )
}

interface RuleShellProps {
  index: number
  validation?: ValidationResult
  onDelete: () => void
  children: ReactNode
}

export function RuleShell({ index, validation, onDelete, children }: RuleShellProps) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Badge variant="outline">Rule {index + 1}</Badge>
          {validation &&
            (validation.isValid ? (
              <CheckCircle
                className="h-4 w-4 text-green-600"
                role="img"
                aria-label={`Rule ${index + 1} is valid`}
              />
            ) : (
              <AlertCircle
                className="h-4 w-4 text-red-600"
                role="img"
                aria-label={`Rule ${index + 1} has errors`}
              />
            ))}
        </div>
        <Button
          onClick={onDelete}
          size="sm"
          variant="ghost"
          className="text-destructive h-8 w-8 p-0"
          aria-label={`Delete rule ${index + 1}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {validation && !validation.isValid && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{validation.errors.join(", ")}</AlertDescription>
        </Alert>
      )}

      {validation && validation.warnings.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{validation.warnings.join(", ")}</AlertDescription>
        </Alert>
      )}

      {children}
    </div>
  )
}
