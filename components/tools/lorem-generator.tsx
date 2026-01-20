"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, FileText, RefreshCw } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { useToast } from "@/hooks/use-toast"

const WORDS = [
  "lorem",
  "ipsum",
  "dolor",
  "sit",
  "amet",
  "consectetur",
  "adipiscing",
  "elit",
  "sed",
  "do",
  "eiusmod",
  "tempor",
  "incididunt",
  "ut",
  "labore",
  "et",
  "dolore",
  "magna",
  "aliqua",
  "enim",
  "ad",
  "minim",
  "veniam",
  "quis",
  "nostrud",
  "exercitation",
  "ullamco",
  "laboris",
  "nisi",
  "aliquip",
  "ex",
  "ea",
  "commodo",
  "consequat",
  "duis",
  "aute",
  "irure",
  "in",
  "reprehenderit",
  "voluptate",
  "velit",
  "esse",
  "cillum",
  "fugiat",
  "nulla",
  "pariatur",
  "excepteur",
  "sint",
  "occaecat",
  "cupidatat",
  "non",
  "proident",
  "sunt",
  "culpa",
  "qui",
  "officia",
  "deserunt",
  "mollit",
  "anim",
  "id",
  "est",
  "laborum",
  "ac",
  "ante",
  "arcu",
  "at",
  "auctor",
  "bibendum",
  "blandit",
  "condimentum",
  "congue",
  "cras",
  "cursus",
  "diam",
  "dictum",
  "dignissim",
  "donec",
  "dui",
  "eget",
  "eleifend",
  "elementum",
  "facilisi",
  "faucibus",
  "felis",
  "fermentum",
  "fringilla",
  "gravida",
  "habitant",
  "hendrerit",
  "imperdiet",
  "integer",
  "interdum",
  "justo",
  "lacinia",
  "lacus",
  "laoreet",
  "lectus",
  "leo",
  "libero",
  "ligula",
  "lobortis",
  "luctus",
  "maecenas",
  "massa",
  "mattis",
  "mauris",
  "metus",
  "morbi",
  "nam",
  "nec",
  "neque",
  "nibh",
  "nisl",
  "nullam",
  "nunc",
  "odio",
  "orci",
  "ornare",
  "pellentesque",
  "pharetra",
  "placerat",
  "porta",
  "posuere",
  "praesent",
  "pretium",
  "proin",
  "pulvinar",
  "purus",
  "quam",
  "risus",
  "sagittis",
  "sapien",
  "scelerisque",
  "semper",
  "senectus",
  "sodales",
  "suspendisse",
  "tellus",
  "tincidunt",
  "tortor",
  "tristique",
  "turpis",
  "ultrices",
  "ultricies",
  "urna",
  "varius",
  "vehicula",
  "vel",
  "vestibulum",
  "vitae",
  "vivamus",
  "viverra",
  "volutpat",
  "vulputate",
]

function randomWord(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)]
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function generateSentence(minWords: number = 5, maxWords: number = 15): string {
  const length = Math.floor(Math.random() * (maxWords - minWords + 1)) + minWords
  const words = Array.from({ length }, randomWord)
  words[0] = capitalize(words[0])
  return words.join(" ") + "."
}

function generateParagraph(minSentences: number = 3, maxSentences: number = 7): string {
  const length = Math.floor(Math.random() * (maxSentences - minSentences + 1)) + minSentences
  return Array.from({ length }, () => generateSentence()).join(" ")
}

type GenerateMode = "paragraphs" | "sentences" | "words"

export function LoremGenerator() {
  const { toast } = useToast()
  const [mode, setMode] = useState<GenerateMode>("paragraphs")
  const [count, setCount] = useState(3)
  const [text, setText] = useState("")
  const [startWithLorem, setStartWithLorem] = useState(true)

  const generate = useCallback(() => {
    let result = ""

    switch (mode) {
      case "paragraphs":
        result = Array.from({ length: count }, () => generateParagraph()).join("\n\n")
        break
      case "sentences":
        result = Array.from({ length: count }, () => generateSentence()).join(" ")
        break
      case "words":
        result = Array.from({ length: count }, randomWord).join(" ")
        break
    }

    if (startWithLorem && result.length > 0) {
      result = "Lorem ipsum dolor sit amet" + result.slice(result.indexOf(" "))
    }

    setText(result)
  }, [mode, count, startWithLorem])

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Copied", description: "Lorem ipsum text copied" })
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  const getMaxCount = () => {
    switch (mode) {
      case "paragraphs":
        return 20
      case "sentences":
        return 50
      case "words":
        return 500
    }
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length
  const charCount = text.length

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
            <CardDescription>Customize the generated text</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Generate</Label>
              <Tabs value={mode} onValueChange={(v) => setMode(v as GenerateMode)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="paragraphs">Paragraphs</TabsTrigger>
                  <TabsTrigger value="sentences">Sentences</TabsTrigger>
                  <TabsTrigger value="words">Words</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  {mode === "paragraphs"
                    ? "Paragraphs"
                    : mode === "sentences"
                      ? "Sentences"
                      : "Words"}
                </Label>
                <Badge variant="outline">{count}</Badge>
              </div>
              <Slider
                value={[count]}
                onValueChange={([v]) => setCount(v)}
                min={1}
                max={getMaxCount()}
                step={1}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="startWithLorem"
                checked={startWithLorem}
                onChange={(e) => setStartWithLorem(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="startWithLorem" className="cursor-pointer">
                Start with "Lorem ipsum..."
              </Label>
            </div>

            <Button onClick={generate} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Generate
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Generated Text</CardTitle>
                <CardDescription>
                  {text
                    ? `${wordCount} words, ${charCount} characters`
                    : "Click generate to create text"}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={copyToClipboard} disabled={!text}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
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
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "1 Paragraph", mode: "paragraphs" as const, count: 1 },
              { label: "3 Paragraphs", mode: "paragraphs" as const, count: 3 },
              { label: "5 Paragraphs", mode: "paragraphs" as const, count: 5 },
              { label: "10 Sentences", mode: "sentences" as const, count: 10 },
              { label: "50 Words", mode: "words" as const, count: 50 },
              { label: "100 Words", mode: "words" as const, count: 100 },
              { label: "200 Words", mode: "words" as const, count: 200 },
              { label: "500 Words", mode: "words" as const, count: 500 },
            ].map((preset) => (
              <Button
                key={preset.label}
                variant="outline"
                onClick={() => {
                  setMode(preset.mode)
                  setCount(preset.count)
                }}
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
