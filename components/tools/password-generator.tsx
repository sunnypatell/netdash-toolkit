"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { Copy, RefreshCw, Key, Check, Eye, EyeOff, Shield } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { useToast } from "@/hooks/use-toast"

interface PasswordOptions {
  length: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
  excludeAmbiguous: boolean
  excludeSimilar: boolean
}

interface PasswordStrength {
  score: number
  label: string
  color: string
  entropy: number
}

const CHARS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?",
  ambiguous: "{}[]()/\\'\"`~,;:.<>",
  similar: "il1Lo0O",
}

function generatePassword(options: PasswordOptions): string {
  let charset = ""

  if (options.uppercase) charset += CHARS.uppercase
  if (options.lowercase) charset += CHARS.lowercase
  if (options.numbers) charset += CHARS.numbers
  if (options.symbols) charset += CHARS.symbols

  if (options.excludeAmbiguous) {
    for (const char of CHARS.ambiguous) {
      charset = charset.replace(char, "")
    }
  }

  if (options.excludeSimilar) {
    for (const char of CHARS.similar) {
      charset = charset.replace(char, "")
    }
  }

  if (charset.length === 0) {
    charset = CHARS.lowercase + CHARS.numbers
  }

  let password = ""
  const array = new Uint32Array(options.length)
  crypto.getRandomValues(array)

  for (let i = 0; i < options.length; i++) {
    password += charset[array[i] % charset.length]
  }

  return password
}

function calculateStrength(password: string, options: PasswordOptions): PasswordStrength {
  let charsetSize = 0
  if (options.uppercase) charsetSize += 26
  if (options.lowercase) charsetSize += 26
  if (options.numbers) charsetSize += 10
  if (options.symbols) charsetSize += CHARS.symbols.length

  const entropy = Math.log2(Math.pow(charsetSize, password.length))

  let score = 0
  let label = "Very Weak"
  let color = "bg-red-500"

  if (entropy >= 128) {
    score = 100
    label = "Excellent"
    color = "bg-green-600"
  } else if (entropy >= 80) {
    score = 80
    label = "Strong"
    color = "bg-green-500"
  } else if (entropy >= 60) {
    score = 60
    label = "Good"
    color = "bg-yellow-500"
  } else if (entropy >= 40) {
    score = 40
    label = "Fair"
    color = "bg-orange-500"
  } else if (entropy >= 28) {
    score = 20
    label = "Weak"
    color = "bg-red-500"
  }

  return { score, label, color, entropy: Math.round(entropy) }
}

export function PasswordGenerator() {
  const { toast } = useToast()
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(true)
  const [copied, setCopied] = useState(false)
  const [options, setOptions] = useState<PasswordOptions>({
    length: 16,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    excludeAmbiguous: false,
    excludeSimilar: false,
  })
  const [history, setHistory] = useState<string[]>([])

  const strength = password ? calculateStrength(password, options) : null

  const generate = useCallback(() => {
    const newPassword = generatePassword(options)
    setPassword(newPassword)
    setHistory((prev) => [newPassword, ...prev.slice(0, 9)])
    setCopied(false)
  }, [options])

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({ title: "Copied", description: "Password copied to clipboard" })
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  const updateOption = <K extends keyof PasswordOptions>(key: K, value: PasswordOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Key}
        title="Password Generator"
        description="Generate cryptographically secure random passwords"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Generated Password</CardTitle>
            <CardDescription>Click generate to create a new password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                readOnly
                placeholder="Click generate..."
                className="h-14 pr-20 font-mono text-lg"
              />
              <div className="absolute top-1/2 right-2 flex -translate-y-1/2 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                  className="h-8 w-8 p-0"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyToClipboard}
                  disabled={!password}
                  className="h-8 w-8 p-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {strength && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Strength</span>
                  <Badge className={strength.color}>{strength.label}</Badge>
                </div>
                <Progress value={strength.score} className="h-2" />
                <p className="text-muted-foreground text-xs">~{strength.entropy} bits of entropy</p>
              </div>
            )}

            <Button onClick={generate} className="w-full" size="lg">
              <RefreshCw className="mr-2 h-4 w-4" />
              Generate Password
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Options</CardTitle>
            <CardDescription>Customize password generation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Length: {options.length} characters</Label>
                <Badge variant="outline">{options.length}</Badge>
              </div>
              <Slider
                value={[options.length]}
                onValueChange={([value]) => updateOption("length", value)}
                min={8}
                max={128}
                step={1}
                className="w-full"
              />
              <div className="text-muted-foreground flex justify-between text-xs">
                <span>8</span>
                <span>128</span>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Character Types</Label>
              <div className="space-y-3">
                {[
                  { key: "uppercase" as const, label: "Uppercase (A-Z)", sample: "ABCDEF" },
                  { key: "lowercase" as const, label: "Lowercase (a-z)", sample: "abcdef" },
                  { key: "numbers" as const, label: "Numbers (0-9)", sample: "012345" },
                  { key: "symbols" as const, label: "Symbols (!@#$)", sample: "!@#$%^" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center space-x-3">
                    <Checkbox
                      id={item.key}
                      checked={options[item.key]}
                      onCheckedChange={(checked) => updateOption(item.key, !!checked)}
                    />
                    <Label htmlFor={item.key} className="flex-1 cursor-pointer">
                      {item.label}
                    </Label>
                    <code className="text-muted-foreground text-xs">{item.sample}</code>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              <Label>Exclusions</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="excludeAmbiguous"
                    checked={options.excludeAmbiguous}
                    onCheckedChange={(checked) => updateOption("excludeAmbiguous", !!checked)}
                  />
                  <Label htmlFor="excludeAmbiguous" className="cursor-pointer">
                    Exclude ambiguous characters
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="excludeSimilar"
                    checked={options.excludeSimilar}
                    onCheckedChange={(checked) => updateOption("excludeSimilar", !!checked)}
                  />
                  <Label htmlFor="excludeSimilar" className="cursor-pointer">
                    Exclude similar characters (i, l, 1, L, o, 0, O)
                  </Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Passwords</CardTitle>
            <CardDescription>Last 10 generated passwords (session only)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((pw, i) => (
                <div
                  key={i}
                  className="hover:bg-muted/50 flex items-center justify-between rounded-lg border p-2"
                >
                  <code className="flex-1 truncate font-mono text-sm">{pw}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await navigator.clipboard.writeText(pw)
                      toast({ title: "Copied" })
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Password Security Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Shield,
                title: "Use 16+ characters",
                desc: "Longer passwords are exponentially harder to crack",
              },
              {
                icon: Key,
                title: "Use a password manager",
                desc: "Store unique passwords for every account securely",
              },
              {
                icon: RefreshCw,
                title: "Never reuse passwords",
                desc: "One breach shouldn't compromise multiple accounts",
              },
            ].map((tip, i) => (
              <div key={i} className="flex gap-3 rounded-lg border p-4">
                <tip.icon className="text-primary h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">{tip.title}</p>
                  <p className="text-muted-foreground text-xs">{tip.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
