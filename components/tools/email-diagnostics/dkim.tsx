"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { AlertTriangle, CheckCircle2, Info, Key } from "lucide-react"
import type { DKIMResult } from "@/lib/email-auth"
import { Issues } from "./issues"

export interface DKIMPanelProps {
  results: DKIMResult[]
}

export function DKIMPanel({ results }: DKIMPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" aria-hidden="true" />
          DKIM Records
        </CardTitle>
        <CardDescription>DomainKeys Identified Mail signatures</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {results.length > 0 ? (
          <Accordion type="single" collapsible className="w-full">
            {results.map((dkim) => (
              <AccordionItem key={dkim.selector} value={`dkim-${dkim.selector}`}>
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    {dkim.valid && !dkim.testing ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" aria-hidden="true" />
                    )}
                    <span>Selector: {dkim.selector}</span>
                    <Badge variant="outline" className="text-xs">
                      {dkim.keyType || "rsa"}
                    </Badge>
                    {dkim.testing && (
                      <Badge variant="secondary" className="text-xs">
                        testing
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  {dkim.record && (
                    <div className="bg-muted rounded-lg p-3">
                      <code className="text-xs break-all">{dkim.record}</code>
                    </div>
                  )}
                  <Issues errors={dkim.errors} warnings={dkim.warnings} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <Alert>
            <Info className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>
              No DKIM records found with common selectors. DKIM keys are only discoverable by
              selector name, so a domain can sign mail with a selector this list does not include -
              enter it above if you know it.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
