"use client"

import { useCallback, useMemo, useState } from "react"
import { parseAsBoolean, parseAsInteger, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RefreshCw, Key, Eye, EyeOff, Shield, AlertCircle } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import { toast } from "sonner"
import {
  buildCharset,
  generatePassword,
  strengthOf,
  EmptyCharsetError,
  type PasswordOptions,
} from "@/lib/password-gen"

const MIN_LENGTH = 8
const MAX_LENGTH = 128

const CHARACTER_CLASSES = [
  { key: "upper", id: "upper", label: "Uppercase (A-Z)", sample: "ABCDEF" },
  { key: "lower", id: "lower", label: "Lowercase (a-z)", sample: "abcdef" },
  { key: "digits", id: "digits", label: "Numbers (0-9)", sample: "012345" },
  { key: "symbols", id: "symbols", label: "Symbols (!@#$)", sample: "!@#$%^" },
] as const

export function PasswordGenerator() {
  // the options live in the query string so a policy ("32 chars, no symbols")
  // is shareable. the generated password never does: a secret in a url is a
  // secret in browser history, in the referer header and in every proxy log,
  // and a password reproducible from a link is not a password.
  const [query, setQuery] = useQueryStates(
    {
      length: parseAsInteger.withDefault(16),
      upper: parseAsBoolean.withDefault(true),
      lower: parseAsBoolean.withDefault(true),
      digits: parseAsBoolean.withDefault(true),
      symbols: parseAsBoolean.withDefault(true),
      noAmbiguous: parseAsBoolean.withDefault(false),
      noSimilar: parseAsBoolean.withDefault(false),
    },
    // dragging the length slider should not fill the back button
    { history: "replace" }
  )

  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(true)
  const [history, setHistory] = useState<string[]>([])

  const options: PasswordOptions = useMemo(
    () => ({
      length: Math.min(Math.max(query.length, MIN_LENGTH), MAX_LENGTH),
      uppercase: query.upper,
      lowercase: query.lower,
      numbers: query.digits,
      symbols: query.symbols,
      excludeAmbiguous: query.noAmbiguous,
      excludeSimilar: query.noSimilar,
    }),
    [query]
  )

  // entropy is quoted from the charset that will actually be drawn from, so
  // exclusions move the number and an empty charset is an error, not -Infinity
  const charset = useMemo(() => buildCharset(options), [options])
  const strength = useMemo(() => strengthOf(charset.length, options.length), [charset, options])
  const empty = charset.length === 0

  const generate = useCallback(() => {
    try {
      const next = generatePassword(options)
      setPassword(next)
      setHistory((prev) => [next, ...prev.slice(0, 9)])
    } catch (e) {
      setPassword("")
      toast.error(e instanceof EmptyCharsetError ? e.message : "Could not generate a password")
    }
  }, [options])

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Key}
        title="Password Generator"
        description="Generate passwords from crypto.getRandomValues with a uniform, unbiased character distribution"
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
                aria-label="Generated password"
              />
              <div className="absolute top-1/2 right-2 flex -translate-y-1/2 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                  className="h-8 w-8 p-0"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                {password && <CopyButton value={password} className="h-8 w-8 p-0" />}
              </div>
            </div>

            {empty ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription id="password-charset-error">
                  No characters left to choose from. Enable a character type, or relax the
                  exclusions - excluding both ambiguous and similar characters from numbers alone
                  empties the set.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Strength</span>
                  <Badge className={strength.color}>{strength.label}</Badge>
                </div>
                <Progress
                  value={strength.score}
                  className="h-2"
                  aria-label={`Password strength: ${strength.label}`}
                />
                <p className="text-muted-foreground text-xs">
                  ~{strength.entropy} bits of entropy - {options.length} characters drawn from{" "}
                  {charset.length} possible
                </p>
              </div>
            )}

            <Button onClick={generate} className="w-full" size="lg" disabled={empty}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Generate Password
            </Button>

            <div className="space-y-1">
              <Label className="text-xs">Character set in use ({charset.length})</Label>
              <code className="bg-muted/50 text-muted-foreground block rounded p-2 text-xs break-all">
                {charset || "(empty)"}
              </code>
            </div>
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
                onValueChange={([value]) => setQuery({ length: value })}
                min={MIN_LENGTH}
                max={MAX_LENGTH}
                step={1}
                className="w-full"
                aria-label="Password length"
              />
              <div className="text-muted-foreground flex justify-between text-xs">
                <span>{MIN_LENGTH}</span>
                <span>{MAX_LENGTH}</span>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Character Types</Label>
              <div className="space-y-3">
                {CHARACTER_CLASSES.map((item) => (
                  <div key={item.key} className="flex items-center space-x-3">
                    <Checkbox
                      id={item.id}
                      checked={query[item.key]}
                      onCheckedChange={(checked) => setQuery({ [item.key]: !!checked })}
                      aria-invalid={empty}
                      aria-describedby={empty ? "password-charset-error" : undefined}
                    />
                    <Label htmlFor={item.id} className="flex-1 cursor-pointer">
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
                    id="noAmbiguous"
                    checked={query.noAmbiguous}
                    onCheckedChange={(checked) => setQuery({ noAmbiguous: !!checked })}
                    aria-invalid={empty}
                    aria-describedby={empty ? "password-charset-error" : undefined}
                  />
                  <Label htmlFor="noAmbiguous" className="cursor-pointer">
                    Exclude ambiguous characters ({"{}[]()/\\'\"`~,;:.<>"})
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="noSimilar"
                    checked={query.noSimilar}
                    onCheckedChange={(checked) => setQuery({ noSimilar: !!checked })}
                    aria-invalid={empty}
                    aria-describedby={empty ? "password-charset-error" : undefined}
                  />
                  <Label htmlFor="noSimilar" className="cursor-pointer">
                    Exclude similar characters (i, l, 1, L, o, 0, O)
                  </Label>
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                Exclusions strip every occurrence and shrink the entropy figure above accordingly.
              </p>
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
                  <CopyButton value={pw} />
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
                <tip.icon className="text-primary h-5 w-5 shrink-0" />
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
