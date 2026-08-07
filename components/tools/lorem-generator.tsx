"use client"

import { useCallback, useState } from "react"
import { parseAsBoolean, parseAsInteger, parseAsStringLiteral, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, RefreshCw } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import {
  LOREM_MAX,
  countParagraphs,
  countSentences,
  countWords,
  generateLorem,
  type LoremMode,
} from "@/lib/lorem"

const MODES = ["paragraphs", "sentences", "words"] as const

const MODE_LABELS: Record<LoremMode, string> = {
  paragraphs: "Paragraphs",
  sentences: "Sentences",
  words: "Words",
}

const PRESETS: { label: string; mode: LoremMode; count: number }[] = [
  { label: "1 paragraph", mode: "paragraphs", count: 1 },
  { label: "3 paragraphs", mode: "paragraphs", count: 3 },
  { label: "5 paragraphs", mode: "paragraphs", count: 5 },
  { label: "10 sentences", mode: "sentences", count: 10 },
  { label: "50 words", mode: "words", count: 50 },
  { label: "100 words", mode: "words", count: 100 },
  { label: "200 words", mode: "words", count: 200 },
  { label: "500 words", mode: "words", count: 500 },
]

function CountSlider({
  mode,
  count,
  onCount,
}: {
  mode: LoremMode
  count: number
  onCount: (value: number) => void
}) {
  const max = LOREM_MAX[mode]
  const clamped = Math.min(Math.max(count, 1), max)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {/* the thumb, not the root, carries role="slider", so the accessible
            name goes through aria-label rather than htmlFor */}
        <Label>{MODE_LABELS[mode]} to generate</Label>
        <Badge variant="outline">{clamped}</Badge>
      </div>
      <Slider
        value={[clamped]}
        onValueChange={([value]) => onCount(value)}
        min={1}
        max={max}
        step={1}
        aria-label={`Number of ${mode} to generate`}
      />
      <p className="text-muted-foreground text-xs">1 to {max}</p>
    </div>
  )
}

export function LoremGenerator() {
  // the options live in the query string; the text does not. placeholder prose
  // is drawn at random, so a link cannot promise to reproduce it and should not
  // pretend to - the Generate button is the honest contract.
  const [query, setQuery] = useQueryStates(
    {
      mode: parseAsStringLiteral(MODES).withDefault("paragraphs"),
      count: parseAsInteger.withDefault(3),
      classic: parseAsBoolean.withDefault(true),
    },
    // dragging the count slider should not fill the back button
    { history: "replace" }
  )

  const { mode, classic } = query
  const count = Math.min(Math.max(query.count, 1), LOREM_MAX[mode])
  const [text, setText] = useState("")

  const generate = useCallback(() => {
    setText(generateLorem({ mode, count, startWithLorem: classic }))
  }, [mode, count, classic])

  const stats = text
    ? `${countParagraphs(text)} paragraphs, ${countSentences(text)} sentences, ${countWords(text)} words, ${text.length} characters`
    : "Click generate to create text"

  return (
    <div className="tool-container">
      <ToolHeader
        icon={FileText}
        title="Lorem Ipsum Generator"
        description="Generate placeholder text for designs and mockups"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Options</CardTitle>
            <CardDescription>Shared by link; the text itself is drawn fresh</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs
              value={mode}
              onValueChange={(v) => setQuery({ mode: v as LoremMode })}
              className="gap-6"
            >
              <div className="space-y-2">
                <Label id="generate-mode-label">Generate</Label>
                <TabsList aria-labelledby="generate-mode-label" className="grid w-full grid-cols-3">
                  {MODES.map((value) => (
                    <TabsTrigger key={value} value={value}>
                      {MODE_LABELS[value]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* one panel per trigger: a single TabsContent whose value tracked the
                  active tab left the other two triggers pointing at nothing */}
              {MODES.map((value) => (
                <TabsContent key={value} value={value}>
                  <CountSlider
                    mode={value}
                    count={count}
                    onCount={(next) => setQuery({ count: next })}
                  />
                </TabsContent>
              ))}
            </Tabs>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="classic-opening"
                checked={classic}
                onCheckedChange={(checked) => setQuery({ classic: !!checked })}
              />
              <Label htmlFor="classic-opening" className="cursor-pointer">
                Start with the classic &quot;Lorem ipsum dolor sit amet&quot;
              </Label>
            </div>
            <p className="text-muted-foreground text-xs">
              The opening words count toward the total, so 50 words means 50 words.
            </p>

            <Button onClick={generate} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Generate
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Generated Text</CardTitle>
                <CardDescription>{stats}</CardDescription>
              </div>
              {text && <CopyButton value={text} variant="outline" />}
            </div>
          </CardHeader>
          <CardContent>
            {text ? (
              <div className="bg-muted/50 max-h-[500px] overflow-y-auto rounded-lg border p-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center rounded-lg border">
                <p className="text-muted-foreground">Click generate to create placeholder text</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Presets</CardTitle>
          <CardDescription>Each one sets the options; press Generate for the text</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant="outline"
                onClick={() => setQuery({ mode: preset.mode, count: preset.count })}
                className="h-auto py-3"
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
