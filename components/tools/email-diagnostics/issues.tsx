"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, XCircle } from "lucide-react"

interface IssuesProps {
  errors?: string[]
  warnings?: string[]
}

export function Issues({ errors = [], warnings = [] }: IssuesProps) {
  return (
    <>
      {errors.length > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            <ul className="list-inside list-disc">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            <ul className="list-inside list-disc">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </>
  )
}
