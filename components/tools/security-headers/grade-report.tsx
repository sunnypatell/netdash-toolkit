"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Info,
  ShieldAlert,
  XCircle,
} from "lucide-react"
import { dateStamp, downloadTextFile } from "@/lib/download"
import { describeStatus, type ResponseBlock } from "@/lib/http-header-parse"
import { gradeBlock, hstsIsHonoured, type HeaderVerdict } from "@/lib/security-header-grade"

export type GradeSource = "pasted" | "relay"

export interface GradeInput {
  label: string
  source: GradeSource
  // the url the response came from, so an hsts policy can be checked against it
  url: string
  blocks: ResponseBlock[]
}

export function gradeColor(grade: string) {
  if (grade.startsWith("A")) return "text-green-600 bg-green-100"
  if (grade.startsWith("B")) return "text-blue-600 bg-blue-100"
  if (grade.startsWith("C")) return "text-yellow-600 bg-yellow-100"
  if (grade === "?") return "text-gray-600 bg-gray-100"
  return "text-red-600 bg-red-100"
}

function verdictIcon(verdict: HeaderVerdict) {
  switch (verdict) {
    case "effective":
      return <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
    case "ineffective":
      return <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
    case "missing":
      return <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
    default:
      return <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
  }
}

function verdictLabel(verdict: HeaderVerdict) {
  switch (verdict) {
    case "effective":
      return "In force"
    case "ineffective":
      // the distinction the old presence-only grade could not draw
      return "Sent, but does nothing"
    case "missing":
      return "Not sent"
    default:
      return "Not scored"
  }
}

function verdictVariant(verdict: HeaderVerdict) {
  if (verdict === "effective") return "default" as const
  if (verdict === "missing") return "destructive" as const
  if (verdict === "ineffective") return "secondary" as const
  return "outline" as const
}

export function GradeReport({ input }: { input: GradeInput }) {
  // a redirect chain ends at the response that serves content, so grade that one
  const final = input.blocks[input.blocks.length - 1]
  const grade = gradeBlock(final)
  const hstsHonoured = hstsIsHonoured(final, input.url)

  // the source travels with the grade, so a relayed result stays labelled unverified in the file
  const exportGrade = () => {
    downloadTextFile(
      JSON.stringify(
        {
          url: input.url,
          source: input.source,
          verified: input.source !== "relay",
          exportedAt: new Date().toISOString(),
          grade,
        },
        null,
        2
      ),
      `security-headers-${input.label || "response"}-${dateStamp()}.json`,
      "application/json"
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            Header score
            <Button variant="outline" size="sm" onClick={exportGrade}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Export
            </Button>
          </CardTitle>
          <CardDescription className="break-all">{input.label}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {input.source === "relay" ? (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Unverified - via third-party relay.</strong> These headers were reported by
                api.hackertarget.com, not read from the server by you. Do not treat this grade as
                authoritative.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Graded from headers you supplied. Nothing was fetched and nothing was uploaded.
              </AlertDescription>
            </Alert>
          )}

          {!hstsHonoured && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                This response came over cleartext HTTP, and RFC 6797 §8.1 makes a user agent ignore
                any Strict-Transport-Security field on a non-secure response. It is scored below,
                but no browser will act on it.
              </AlertDescription>
            </Alert>
          )}

          <div className="text-center">
            <div
              className={`inline-flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold ${gradeColor(grade.grade)}`}
            >
              {grade.grade}
            </div>
            <p className="mt-2 text-2xl font-bold">{grade.score}%</p>
            <p className="text-muted-foreground text-sm">
              {input.source === "relay" ? "Unverified header score" : "Header score"}
            </p>
          </div>

          <Progress value={grade.score} className="h-3" />

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border p-2">
              <p className="text-2xl font-bold text-green-600">{grade.effectiveCount}</p>
              <p className="text-muted-foreground text-xs">In force</p>
            </div>
            <div className="rounded-lg border p-2">
              <p className="text-2xl font-bold text-amber-600">
                {
                  grade.assessments.filter((a) => a.verdict === "ineffective" && a.weight > 0)
                    .length
                }
              </p>
              <p className="text-muted-foreground text-xs">Sent but inert</p>
            </div>
            <div className="rounded-lg border p-2">
              <p className="text-2xl font-bold text-red-600">
                {grade.assessments.filter((a) => a.verdict === "missing").length}
              </p>
              <p className="text-muted-foreground text-xs">Not sent</p>
            </div>
          </div>

          <div className="text-muted-foreground space-y-1 text-xs">
            <p>
              {final.status > 0
                ? `Graded the final response: ${describeStatus(final)}`
                : "No status line in the paste - graded the header block as given"}
            </p>
            <p>
              {input.blocks.length > 1
                ? `${input.blocks.length} response blocks found (redirect chain), graded the last one`
                : `${final.fields.length} field lines in the response`}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Header analysis</CardTitle>
          <CardDescription>
            {input.source === "relay"
              ? "Values as reported by the relay - unverified"
              : "Values from your own request"}
            . Each verdict is the spec clause applied to the value, not just whether the name
            appeared.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {grade.assessments.map((assessment) => {
              const tone =
                assessment.verdict === "effective"
                  ? "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20"
                  : assessment.verdict === "missing"
                    ? "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20"
                    : assessment.verdict === "ineffective"
                      ? "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"
                      : "border-border"
              return (
                <div key={assessment.key} className={`rounded-lg border p-4 ${tone}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      {verdictIcon(assessment.verdict)}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-sm font-medium">{assessment.name}</p>
                          <Badge variant={verdictVariant(assessment.verdict)}>
                            {verdictLabel(assessment.verdict)}
                          </Badge>
                          <Badge variant="outline" className="text-xs font-normal">
                            {assessment.spec}
                          </Badge>
                          {input.source === "relay" && assessment.values.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              via relay
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground mt-1 text-sm">{assessment.detail}</p>
                        {assessment.values.map((value, i) => (
                          <p
                            key={i}
                            className="text-muted-foreground bg-muted/50 mt-2 rounded p-2 font-mono text-xs break-all"
                          >
                            {value}
                          </p>
                        ))}
                        {assessment.notes.length > 0 && (
                          <ul className="text-muted-foreground mt-2 list-inside list-disc space-y-1 text-xs">
                            {assessment.notes.map((note, i) => (
                              <li key={i}>{note}</li>
                            ))}
                          </ul>
                        )}
                        {assessment.recommendation && (
                          <div className="mt-2 flex items-start gap-2 text-sm">
                            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                            <span className="text-muted-foreground">
                              {assessment.recommendation}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <a
                      href={assessment.learnMore}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground flex-shrink-0"
                      aria-label={`MDN documentation for ${assessment.name}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
