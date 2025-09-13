"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Copy, Download, Plus, Trash2, Shield, CheckCircle, AlertCircle, FileText } from "lucide-react"
import { ipv4ToInt, intToIpv4 } from "@/lib/network-utils"

interface ACLRule {
  id: string
  action: "permit" | "deny"
  protocol: "any" | "tcp" | "udp" | "icmp"
  sourceNetwork: string
  sourceWildcard?: string
  destNetwork: string
  destWildcard?: string
  sourcePort?: string
  destPort?: string
  description?: string
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export function ACLGenerator() {
  const [rules, setRules] = useState<ACLRule[]>([
    {
      id: "1",
      action: "permit",
      protocol: "tcp",
      sourceNetwork: "10.0.0.0/24",
      destNetwork: "any",
      destPort: "443",
      description: "Allow HTTPS from internal network",
    },
  ])
  const [aclName, setAclName] = useState("101")
  const [platform, setPlatform] = useState("cisco-ios")
  const [copySuccess, setCopySuccess] = useState(false)
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([])

  const cidrToWildcard = (cidr: string): { network: string; wildcard: string } => {
    try {
      if (cidr === "any") return { network: "any", wildcard: "" }

      const [ip, prefixStr] = cidr.split("/")
      if (!prefixStr) return { network: ip, wildcard: "0.0.0.0" }

      const prefix = Number.parseInt(prefixStr)
      if (prefix < 0 || prefix > 32) {
        throw new Error("Invalid prefix length")
      }

      const mask = (0xffffffff << (32 - prefix)) >>> 0
      const wildcard = ~mask >>> 0

      const networkInt = ipv4ToInt(ip) & mask
      const networkIp = intToIpv4(networkInt)
      const wildcardIp = intToIpv4(wildcard)

      return { network: networkIp, wildcard: wildcardIp }
    } catch {
      return { network: cidr, wildcard: "0.0.0.0" }
    }
  }

  const validateRule = (rule: ACLRule): ValidationResult => {
    const errors: string[] = []
    const warnings: string[] = []

    // Validate source network
    if (rule.sourceNetwork !== "any") {
      try {
        cidrToWildcard(rule.sourceNetwork)
      } catch {
        errors.push("Invalid source network format")
      }
    }

    // Validate destination network
    if (rule.destNetwork !== "any") {
      try {
        cidrToWildcard(rule.destNetwork)
      } catch {
        errors.push("Invalid destination network format")
      }
    }

    // Validate ports
    if (rule.sourcePort && rule.protocol !== "icmp" && rule.protocol !== "any") {
      const port = Number.parseInt(rule.sourcePort)
      if (isNaN(port) || port < 1 || port > 65535) {
        errors.push("Invalid source port (1-65535)")
      }
    }

    if (rule.destPort && rule.protocol !== "icmp" && rule.protocol !== "any") {
      const port = Number.parseInt(rule.destPort)
      if (isNaN(port) || port < 1 || port > 65535) {
        errors.push("Invalid destination port (1-65535)")
      }
    }

    // Warnings for common issues
    if (rule.action === "permit" && rule.sourceNetwork === "any" && rule.destNetwork === "any") {
      warnings.push("Overly permissive rule - consider restricting source or destination")
    }

    if (!rule.description) {
      warnings.push("Consider adding a description for documentation")
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  const validateAllRules = () => {
    const results = rules.map(validateRule)
    setValidationResults(results)
    return results
  }

  const generateCiscoACL = (rule: ACLRule, index: number): string => {
    const { network: srcNet, wildcard: srcWild } = cidrToWildcard(rule.sourceNetwork)
    const { network: dstNet, wildcard: dstWild } = cidrToWildcard(rule.destNetwork)

    let line = `access-list ${aclName} ${rule.action}`

    // Protocol
    line += ` ${rule.protocol}`

    // Source
    if (srcNet === "any") {
      line += " any"
    } else {
      line += ` ${srcNet} ${srcWild}`
    }

    // Source port
    if (rule.sourcePort && rule.protocol !== "icmp" && rule.protocol !== "any") {
      line += ` eq ${rule.sourcePort}`
    }

    // Destination
    if (dstNet === "any") {
      line += " any"
    } else {
      line += ` ${dstNet} ${dstWild}`
    }

    // Destination port
    if (rule.destPort && rule.protocol !== "icmp" && rule.protocol !== "any") {
      line += ` eq ${rule.destPort}`
    }

    return line
  }

  const generatePaloAltoRule = (rule: ACLRule, index: number): string => {
    const ruleName = `rule-${index + 1}`
    let config = `set rulebase security rules ${ruleName} from any\n`
    config += `set rulebase security rules ${ruleName} to any\n`
    config += `set rulebase security rules ${ruleName} source ${rule.sourceNetwork === "any" ? "any" : rule.sourceNetwork}\n`
    config += `set rulebase security rules ${ruleName} destination ${rule.destNetwork === "any" ? "any" : rule.destNetwork}\n`
    config += `set rulebase security rules ${ruleName} application ${rule.protocol === "any" ? "any" : rule.protocol}\n`
    config += `set rulebase security rules ${ruleName} action ${rule.action}\n`

    if (rule.description) {
      config += `set rulebase security rules ${ruleName} description "${rule.description}"\n`
    }

    return config
  }

  const generateJuniperACL = (rule: ACLRule, index: number): string => {
    const termName = `term-${index + 1}`
    let config = `term ${termName} {\n`

    // From clause
    config += "    from {\n"
    if (rule.sourceNetwork !== "any") {
      config += `        source-address ${rule.sourceNetwork};\n`
    }
    if (rule.destNetwork !== "any") {
      config += `        destination-address ${rule.destNetwork};\n`
    }
    if (rule.protocol !== "any") {
      config += `        protocol ${rule.protocol};\n`
    }
    if (rule.destPort && rule.protocol !== "icmp" && rule.protocol !== "any") {
      config += `        destination-port ${rule.destPort};\n`
    }
    config += "    }\n"

    // Then clause
    config += "    then {\n"
    config += `        ${rule.action};\n`
    config += "    }\n"
    config += "}\n"

    return config
  }

  const generateACL = (): string => {
    let output = ""
    const timestamp = new Date().toISOString()

    if (platform === "cisco-ios") {
      output += `! ACL ${aclName} - Generated by Network Toolbox\n`
      output += `! Generated on: ${timestamp}\n`
      output += `! Total rules: ${rules.length}\n`
      output += "!\n"

      rules.forEach((rule, index) => {
        if (rule.description) {
          output += `! Rule ${index + 1}: ${rule.description}\n`
        }
        try {
          output += generateCiscoACL(rule, index) + "\n"
        } catch (error) {
          output += `! Error in rule ${index + 1}: ${error instanceof Error ? error.message : "Unknown error"}\n`
        }
      })

      // Add implicit deny
      output += `access-list ${aclName} deny ip any any\n`
      output += "!\n"
      output += `! Apply to interface:\n`
      output += `! interface GigabitEthernet0/1\n`
      output += `!  ip access-group ${aclName} in\n`
      output += `!  ip access-group ${aclName} out\n`
    } else if (platform === "palo-alto") {
      output += "# Palo Alto Security Rules - Generated by Network Toolbox\n"
      output += `# Generated on: ${timestamp}\n`
      output += `# Total rules: ${rules.length}\n`
      output += "# Apply these commands in configuration mode\n\n"

      rules.forEach((rule, index) => {
        if (rule.description) {
          output += `# Rule ${index + 1}: ${rule.description}\n`
        }
        try {
          output += generatePaloAltoRule(rule, index) + "\n"
        } catch (error) {
          output += `# Error in rule ${index + 1}: ${error instanceof Error ? error.message : "Unknown error"}\n`
        }
      })

      output += "# Commit the configuration\ncommit\n"
    } else if (platform === "juniper-srx") {
      output += `/* Juniper SRX Security Policy - Generated by Network Toolbox */\n`
      output += `/* Generated on: ${timestamp} */\n`
      output += `/* Total rules: ${rules.length} */\n\n`
      output += `security {\n`
      output += `    policies {\n`
      output += `        from-zone trust to-zone untrust {\n`
      output += `            policy ${aclName} {\n`

      rules.forEach((rule, index) => {
        if (rule.description) {
          output += `                /* Rule ${index + 1}: ${rule.description} */\n`
        }
        try {
          output += generateJuniperACL(rule, index)
        } catch (error) {
          output += `                /* Error in rule ${index + 1}: ${error instanceof Error ? error.message : "Unknown error"} */\n`
        }
      })

      output += `            }\n`
      output += `        }\n`
      output += `    }\n`
      output += `}\n`
    }

    return output
  }

  const addRule = () => {
    const newRule: ACLRule = {
      id: Date.now().toString(),
      action: "permit",
      protocol: "tcp",
      sourceNetwork: "any",
      destNetwork: "any",
      description: "",
    }
    setRules([...rules, newRule])
  }

  const updateRule = (id: string, field: keyof ACLRule, value: string) => {
    setRules(rules.map((rule) => (rule.id === id ? { ...rule, [field]: value } : rule)))
  }

  const deleteRule = (id: string) => {
    setRules(rules.filter((rule) => rule.id !== id))
  }

  const duplicateRule = (id: string) => {
    const rule = rules.find((r) => r.id === id)
    if (rule) {
      const newRule = { ...rule, id: Date.now().toString() }
      setRules([...rules, newRule])
    }
  }

  const exportACL = () => {
    const config = generateACL()
    const blob = new Blob([config], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `acl-${aclName}-${platform}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateACL())
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const loadSampleRules = () => {
    console.log("[v0] Loading ACL sample rules...")
    try {
      setRules([
        {
          id: "1",
          action: "permit",
          protocol: "tcp",
          sourceNetwork: "10.0.0.0/24",
          destNetwork: "any",
          destPort: "443",
          description: "Allow HTTPS from internal network",
        },
        {
          id: "2",
          action: "permit",
          protocol: "tcp",
          sourceNetwork: "192.168.1.0/24",
          destNetwork: "10.0.10.0/24",
          destPort: "22",
          description: "Allow SSH from admin network to servers",
        },
        {
          id: "3",
          action: "deny",
          protocol: "tcp",
          sourceNetwork: "any",
          destNetwork: "10.0.10.0/24",
          destPort: "22",
          description: "Block SSH to servers from other networks",
        },
        {
          id: "4",
          action: "permit",
          protocol: "udp",
          sourceNetwork: "any",
          destNetwork: "8.8.8.8/32",
          destPort: "53",
          description: "Allow DNS queries to Google DNS",
        },
        {
          id: "5",
          action: "deny",
          protocol: "icmp",
          sourceNetwork: "0.0.0.0/0",
          destNetwork: "10.0.0.0/8",
          description: "Block ICMP to private networks from internet",
        },
      ])
      console.log("[v0] ACL sample rules loaded successfully")
    } catch (error) {
      console.error("[v0] Error loading ACL sample rules:", error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Shield className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">ACL Generator</h1>
          <p className="text-muted-foreground">
            Generate Access Control Lists for Cisco IOS, Palo Alto, and Juniper SRX with validation and best practices
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>ACL Configuration</CardTitle>
              <CardDescription>Configure ACL name and target platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="acl-name">ACL Name/Number</Label>
                  <Input id="acl-name" value={aclName} onChange={(e) => setAclName(e.target.value)} placeholder="101" />
                </div>
                <div>
                  <Label>Platform</Label>
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cisco-ios">Cisco IOS</SelectItem>
                      <SelectItem value="palo-alto">Palo Alto</SelectItem>
                      <SelectItem value="juniper-srx">Juniper SRX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button onClick={loadSampleRules} variant="outline" className="flex-1 bg-transparent">
                  Load Sample Rules
                </Button>
                <Button onClick={validateAllRules} variant="outline" className="flex-1 bg-transparent">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Validate Rules
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Rules
                <div className="flex space-x-2">
                  <Badge variant="secondary">{rules.length} rules</Badge>
                  <Button onClick={addRule} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Rule
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {rules.map((rule, index) => {
                  const validation = validationResults[index]
                  return (
                    <div key={rule.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">Rule {index + 1}</Badge>
                          {validation && (
                            <>
                              {validation.isValid ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-red-600" />
                              )}
                            </>
                          )}
                        </div>
                        <div className="flex space-x-1">
                          <Button
                            onClick={() => duplicateRule(rule.id)}
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => deleteRule(rule.id)}
                            size="sm"
                            variant="ghost"
                            className="text-destructive h-8 w-8 p-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {validation && !validation.isValid && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{validation.errors.join(", ")}</AlertDescription>
                        </Alert>
                      )}

                      {validation && validation.warnings.length > 0 && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{validation.warnings.join(", ")}</AlertDescription>
                        </Alert>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Action</Label>
                          <Select value={rule.action} onValueChange={(value) => updateRule(rule.id, "action", value)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="permit">Permit</SelectItem>
                              <SelectItem value="deny">Deny</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Protocol</Label>
                          <Select
                            value={rule.protocol}
                            onValueChange={(value) => updateRule(rule.id, "protocol", value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any</SelectItem>
                              <SelectItem value="tcp">TCP</SelectItem>
                              <SelectItem value="udp">UDP</SelectItem>
                              <SelectItem value="icmp">ICMP</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Source Network</Label>
                          <Input
                            value={rule.sourceNetwork}
                            onChange={(e) => updateRule(rule.id, "sourceNetwork", e.target.value)}
                            placeholder="10.0.0.0/24 or any"
                          />
                        </div>
                        <div>
                          <Label>Destination Network</Label>
                          <Input
                            value={rule.destNetwork}
                            onChange={(e) => updateRule(rule.id, "destNetwork", e.target.value)}
                            placeholder="192.168.1.0/24 or any"
                          />
                        </div>
                      </div>

                      {rule.protocol !== "icmp" && rule.protocol !== "any" && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label>Source Port</Label>
                            <Input
                              value={rule.sourcePort || ""}
                              onChange={(e) => updateRule(rule.id, "sourcePort", e.target.value)}
                              placeholder="any or 80"
                            />
                          </div>
                          <div>
                            <Label>Destination Port</Label>
                            <Input
                              value={rule.destPort || ""}
                              onChange={(e) => updateRule(rule.id, "destPort", e.target.value)}
                              placeholder="443"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <Label>Description</Label>
                        <Input
                          value={rule.description || ""}
                          onChange={(e) => updateRule(rule.id, "description", e.target.value)}
                          placeholder="Rule description"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5" />
                <span>Generated Configuration</span>
              </CardTitle>
              <CardDescription>
                Copy this configuration to your{" "}
                {platform === "cisco-ios" ? "Cisco IOS" : platform === "palo-alto" ? "Palo Alto" : "Juniper SRX"} device
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea value={generateACL()} readOnly className="font-mono text-sm min-h-[400px]" />
              <div className="flex space-x-2 mt-4">
                <Button onClick={copyToClipboard} variant="outline" className="flex-1 bg-transparent">
                  <Copy className="w-4 h-4 mr-2" />
                  {copySuccess ? "Copied!" : "Copy"}
                </Button>
                <Button onClick={exportACL} variant="outline" className="flex-1 bg-transparent">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>

          {platform === "cisco-ios" && (
            <Card>
              <CardHeader>
                <CardTitle>Wildcard Mask Reference</CardTitle>
                <CardDescription>Common CIDR to wildcard mask conversions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-3 gap-4 font-medium">
                    <span>CIDR</span>
                    <span>Wildcard Mask</span>
                    <span>Hosts</span>
                  </div>
                  <Separator />
                  {["/24", "/25", "/26", "/27", "/28", "/30"].map((prefix) => {
                    const { wildcard } = cidrToWildcard(`192.168.1.0${prefix}`)
                    const hosts = Math.pow(2, 32 - Number.parseInt(prefix.slice(1))) - 2
                    return (
                      <div key={prefix} className="grid grid-cols-3 gap-4">
                        <span>{prefix}</span>
                        <span className="font-mono">{wildcard}</span>
                        <span>{hosts}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Common Ports Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  { port: "22", service: "SSH" },
                  { port: "23", service: "Telnet" },
                  { port: "25", service: "SMTP" },
                  { port: "53", service: "DNS" },
                  { port: "80", service: "HTTP" },
                  { port: "110", service: "POP3" },
                  { port: "143", service: "IMAP" },
                  { port: "443", service: "HTTPS" },
                  { port: "993", service: "IMAPS" },
                  { port: "995", service: "POP3S" },
                ].map(({ port, service }) => (
                  <div key={port} className="flex justify-between">
                    <span className="font-mono">{port}</span>
                    <span className="text-muted-foreground">{service}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
