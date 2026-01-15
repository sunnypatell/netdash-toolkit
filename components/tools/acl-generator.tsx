"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Copy,
  Download,
  Plus,
  Trash2,
  Shield,
  CheckCircle,
  AlertCircle,
  FileText,
  Network,
  Settings,
} from "lucide-react"
import { calculateIPv4Subnet, isValidIPv4 } from "@/lib/network-utils"
import { useToast } from "@/hooks/use-toast"

interface StandardACLRule {
  id: string
  action: "permit" | "deny"
  sourceNetwork: string
  sourceWildcard?: string
  description?: string
  log?: boolean
}

interface ExtendedACLRule {
  id: string
  action: "permit" | "deny"
  protocol: "any" | "tcp" | "udp" | "icmp" | "ip"
  sourceNetwork: string
  sourceWildcard?: string
  destNetwork: string
  destWildcard?: string
  sourcePort?: string
  sourcePortOperator?: "eq" | "gt" | "lt" | "neq" | "range"
  destPort?: string
  destPortOperator?: "eq" | "gt" | "lt" | "neq" | "range"
  destPortRange?: string
  sourcePortRange?: string
  tcpFlags?: string[]
  icmpType?: string
  icmpCode?: string
  established?: boolean
  log?: boolean
  description?: string
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

type ParsedACLNetwork = {
  kind: "any" | "host" | "network"
  network: string
  wildcard: string
  host?: string
  warnings: string[]
}

const parseACLNetwork = (input: string): ParsedACLNetwork => {
  const trimmed = input.trim()

  if (!trimmed) {
    throw new Error("Network value is required")
  }

  if (trimmed.toLowerCase() === "any") {
    return { kind: "any", network: "any", wildcard: "", warnings: [] }
  }

  if (trimmed.toLowerCase().startsWith("host ")) {
    const hostIp = trimmed.slice(5).trim()
    if (!isValidIPv4(hostIp)) {
      throw new Error("Invalid host address")
    }
    return { kind: "host", network: hostIp, wildcard: "0.0.0.0", host: hostIp, warnings: [] }
  }

  const [address, prefixStr] = trimmed.split("/")
  const normalizedAddress = address.trim()

  if (!isValidIPv4(normalizedAddress)) {
    throw new Error("Invalid IPv4 address")
  }

  if (prefixStr !== undefined) {
    const prefix = Number.parseInt(prefixStr, 10)
    if (isNaN(prefix) || prefix < 0 || prefix > 32) {
      throw new Error("Invalid prefix length")
    }

    const subnet = calculateIPv4Subnet(normalizedAddress, prefix)
    const warnings: string[] = []

    if (subnet.network !== normalizedAddress) {
      warnings.push(`Normalized network to ${subnet.network}/${prefix}`)
    }

    return {
      kind: prefix === 32 ? "host" : "network",
      network: subnet.network,
      wildcard: subnet.wildcardMask,
      host: prefix === 32 ? subnet.network : undefined,
      warnings,
    }
  }

  // No prefix provided – treat as host with implicit wildcard
  return {
    kind: "host",
    network: normalizedAddress,
    wildcard: "0.0.0.0",
    host: normalizedAddress,
    warnings: ["No prefix provided; treating value as a host entry"],
  }
}

export function ACLGenerator() {
  const { toast } = useToast()
  const [aclType, setAclType] = useState<"standard" | "extended">("extended")
  const [standardRules, setStandardRules] = useState<StandardACLRule[]>([
    {
      id: "1",
      action: "permit",
      sourceNetwork: "192.168.1.0/24",
      description: "Allow internal network",
    },
  ])
  const [extendedRules, setExtendedRules] = useState<ExtendedACLRule[]>([
    {
      id: "1",
      action: "permit",
      protocol: "tcp",
      sourceNetwork: "10.0.0.0/24",
      destNetwork: "any",
      destPort: "443",
      destPortOperator: "eq",
      description: "Allow HTTPS from internal network",
    },
  ])
  const [aclName, setAclName] = useState("101")
  const [platform, setPlatform] = useState("cisco-ios")
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([])

  const validateStandardRule = (rule: StandardACLRule): ValidationResult => {
    const errors: string[] = []
    const warnings: string[] = []

    if (rule.sourceNetwork !== "any") {
      try {
        const parsed = parseACLNetwork(rule.sourceNetwork)
        warnings.push(...parsed.warnings)
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Invalid source network format")
      }
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

  const validateExtendedRule = (rule: ExtendedACLRule): ValidationResult => {
    const errors: string[] = []
    const warnings: string[] = []

    // Validate source network
    if (rule.sourceNetwork !== "any") {
      try {
        const parsed = parseACLNetwork(rule.sourceNetwork)
        warnings.push(...parsed.warnings)
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Invalid source network format")
      }
    }

    // Validate destination network
    if (rule.destNetwork !== "any") {
      try {
        const parsed = parseACLNetwork(rule.destNetwork)
        warnings.push(...parsed.warnings)
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Invalid destination network format")
      }
    }

    // Validate ports based on protocol
    if (rule.protocol === "tcp" || rule.protocol === "udp") {
      if (rule.sourcePort && rule.sourcePortOperator !== "range") {
        const port = Number.parseInt(rule.sourcePort)
        if (isNaN(port) || port < 1 || port > 65535) {
          errors.push("Invalid source port (1-65535)")
        }
      }

      if (rule.destPort && rule.destPortOperator !== "range") {
        const port = Number.parseInt(rule.destPort)
        if (isNaN(port) || port < 1 || port > 65535) {
          errors.push("Invalid destination port (1-65535)")
        }
      }

      if (rule.sourcePortOperator === "range" && rule.sourcePortRange) {
        const [start, end] = rule.sourcePortRange.split("-").map((p) => Number.parseInt(p.trim()))
        if (isNaN(start) || isNaN(end) || start < 1 || end > 65535 || start >= end) {
          errors.push("Invalid source port range")
        }
      }

      if (rule.destPortOperator === "range" && rule.destPortRange) {
        const [start, end] = rule.destPortRange.split("-").map((p) => Number.parseInt(p.trim()))
        if (isNaN(start) || isNaN(end) || start < 1 || end > 65535 || start >= end) {
          errors.push("Invalid destination port range")
        }
      }
    }

    // Validate ICMP parameters
    if (rule.protocol === "icmp") {
      if (rule.icmpType) {
        const type = Number.parseInt(rule.icmpType)
        if (isNaN(type) || type < 0 || type > 255) {
          errors.push("Invalid ICMP type (0-255)")
        }
      }
      if (rule.icmpCode) {
        const code = Number.parseInt(rule.icmpCode)
        if (isNaN(code) || code < 0 || code > 255) {
          errors.push("Invalid ICMP code (0-255)")
        }
      }
    }

    // Security warnings
    if (rule.action === "permit" && rule.sourceNetwork === "any" && rule.destNetwork === "any") {
      warnings.push("Overly permissive rule - consider restricting source or destination")
    }

    if (rule.protocol === "tcp" && rule.destPort === "22" && rule.sourceNetwork === "any") {
      warnings.push("SSH access from any source may be a security risk")
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
    const results =
      aclType === "standard"
        ? standardRules.map(validateStandardRule)
        : extendedRules.map(validateExtendedRule)
    setValidationResults(results)
    return results
  }

  const generateStandardCiscoACL = (rule: StandardACLRule, index: number): string => {
    const parsed = parseACLNetwork(rule.sourceNetwork)
    const { kind, network, wildcard, host, warnings } = parsed

    let statement = ""
    if (warnings.length) {
      statement += warnings.map((warning) => `! ${warning}`).join("\n") + "\n"
    }

    statement += `access-list ${aclName} ${rule.action}`

    if (kind === "any") {
      statement += " any"
    } else if (kind === "host") {
      statement += ` host ${host ?? network}`
    } else {
      statement += ` ${network} ${wildcard}`
    }

    if (rule.log) {
      statement += " log"
    }

    return statement
  }

  const generateExtendedCiscoACL = (rule: ExtendedACLRule, index: number): string => {
    const sourceParsed = parseACLNetwork(rule.sourceNetwork)
    const destParsed = parseACLNetwork(rule.destNetwork)

    const warnings = [...sourceParsed.warnings, ...destParsed.warnings]

    let line = ""
    if (warnings.length) {
      line += warnings.map((warning) => `! ${warning}`).join("\n") + "\n"
    }

    line += `access-list ${aclName} ${rule.action}`

    // Protocol
    line += ` ${rule.protocol}`

    // Source
    if (sourceParsed.kind === "any") {
      line += " any"
    } else if (sourceParsed.kind === "host") {
      line += ` host ${sourceParsed.host ?? sourceParsed.network}`
    } else {
      line += ` ${sourceParsed.network} ${sourceParsed.wildcard}`
    }

    // Source port
    if (rule.sourcePort && rule.protocol !== "icmp" && rule.protocol !== "ip") {
      if (rule.sourcePortOperator === "range" && rule.sourcePortRange) {
        line += ` range ${rule.sourcePortRange.replace("-", " ")}`
      } else {
        line += ` ${rule.sourcePortOperator || "eq"} ${rule.sourcePort}`
      }
    }

    // Destination
    if (destParsed.kind === "any") {
      line += " any"
    } else if (destParsed.kind === "host") {
      line += ` host ${destParsed.host ?? destParsed.network}`
    } else {
      line += ` ${destParsed.network} ${destParsed.wildcard}`
    }

    // Destination port
    if (rule.destPort && rule.protocol !== "icmp" && rule.protocol !== "ip") {
      if (rule.destPortOperator === "range" && rule.destPortRange) {
        line += ` range ${rule.destPortRange.replace("-", " ")}`
      } else {
        line += ` ${rule.destPortOperator || "eq"} ${rule.destPort}`
      }
    }

    // ICMP parameters
    if (rule.protocol === "icmp") {
      if (rule.icmpType) {
        line += ` ${rule.icmpType}`
        if (rule.icmpCode) {
          line += ` ${rule.icmpCode}`
        }
      }
    }

    // TCP flags
    if (rule.protocol === "tcp" && rule.established) {
      line += " established"
    }

    // Logging
    if (rule.log) {
      line += " log"
    }

    return line
  }

  const generateACL = (): string => {
    let output = ""
    const timestamp = new Date().toISOString()
    const rules = aclType === "standard" ? standardRules : extendedRules

    if (platform === "cisco-ios") {
      output += `! ${aclType.toUpperCase()} ACL ${aclName} - Generated by Network Toolbox\n`
      output += `! Generated on: ${timestamp}\n`
      output += `! Total rules: ${rules.length}\n`
      output += "!\n"

      rules.forEach((rule, index) => {
        if (rule.description) {
          output += `! Rule ${index + 1}: ${rule.description}\n`
        }
        try {
          if (aclType === "standard") {
            output += generateStandardCiscoACL(rule as StandardACLRule, index) + "\n"
          } else {
            output += generateExtendedCiscoACL(rule as ExtendedACLRule, index) + "\n"
          }
        } catch (error) {
          output += `! Error in rule ${index + 1}: ${error instanceof Error ? error.message : "Unknown error"}\n`
        }
      })

      // Add implicit deny
      if (aclType === "standard") {
        output += `access-list ${aclName} deny any\n`
      } else {
        output += `access-list ${aclName} deny ip any any\n`
      }

      output += "!\n"
      output += `! Apply to interface:\n`
      output += `! interface GigabitEthernet0/1\n`
      output += `!  ip access-group ${aclName} in\n`
      output += `!  ip access-group ${aclName} out\n`
    }

    return output
  }

  const addStandardRule = () => {
    const newRule: StandardACLRule = {
      id: Date.now().toString(),
      action: "permit",
      sourceNetwork: "any",
      description: "",
    }
    setStandardRules([...standardRules, newRule])
  }

  const updateStandardRule = (id: string, field: keyof StandardACLRule, value: string) => {
    setStandardRules(
      standardRules.map((rule) => (rule.id === id ? { ...rule, [field]: value } : rule))
    )
  }

  const deleteStandardRule = (id: string) => {
    setStandardRules(standardRules.filter((rule) => rule.id !== id))
  }

  const addExtendedRule = () => {
    const newRule: ExtendedACLRule = {
      id: Date.now().toString(),
      action: "permit",
      protocol: "tcp",
      sourceNetwork: "any",
      destNetwork: "any",
      destPortOperator: "eq",
      sourcePortOperator: "eq",
      description: "",
    }
    setExtendedRules([...extendedRules, newRule])
  }

  const updateExtendedRule = (
    id: string,
    field: keyof ExtendedACLRule,
    value: string | boolean | string[]
  ) => {
    setExtendedRules(
      extendedRules.map((rule) => (rule.id === id ? { ...rule, [field]: value } : rule))
    )
  }

  const deleteExtendedRule = (id: string) => {
    setExtendedRules(extendedRules.filter((rule) => rule.id !== id))
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateACL())
      toast({
        title: "Copied to clipboard",
        description: "ACL configuration copied successfully",
      })
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const exportACL = () => {
    const config = generateACL()
    const blob = new Blob([config], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `acl-${aclName}-${aclType}-${platform}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const loadSampleRules = () => {
    if (aclType === "standard") {
      setStandardRules([
        {
          id: "1",
          action: "permit",
          sourceNetwork: "192.168.1.0/24",
          description: "Allow internal network",
        },
        {
          id: "2",
          action: "permit",
          sourceNetwork: "host 10.0.0.100",
          description: "Allow specific admin host",
        },
        {
          id: "3",
          action: "deny",
          sourceNetwork: "10.0.0.0/8",
          description: "Block other private networks",
        },
      ])
    } else {
      setExtendedRules([
        {
          id: "1",
          action: "permit",
          protocol: "tcp",
          sourceNetwork: "10.0.0.0/24",
          destNetwork: "any",
          destPort: "443",
          destPortOperator: "eq",
          description: "Allow HTTPS from internal network",
        },
        {
          id: "2",
          action: "permit",
          protocol: "tcp",
          sourceNetwork: "192.168.1.0/24",
          destNetwork: "10.0.10.0/24",
          destPort: "22",
          destPortOperator: "eq",
          established: true,
          description: "Allow established SSH from admin network",
        },
        {
          id: "3",
          action: "deny",
          protocol: "tcp",
          sourceNetwork: "any",
          destNetwork: "10.0.10.0/24",
          destPort: "22",
          destPortOperator: "eq",
          log: true,
          description: "Block and log SSH attempts to servers",
        },
      ])
    }
  }

  const currentRules = aclType === "standard" ? standardRules : extendedRules

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Shield className="text-primary h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Enhanced ACL Generator</h1>
          <p className="text-muted-foreground">
            Generate Standard and Extended Access Control Lists with advanced features and
            validation
          </p>
        </div>
      </div>

      <Tabs
        value={aclType}
        onValueChange={(value) => setAclType(value as "standard" | "extended")}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="standard" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Standard ACL
          </TabsTrigger>
          <TabsTrigger value="extended" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Extended ACL
          </TabsTrigger>
        </TabsList>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>ACL Configuration</CardTitle>
                <CardDescription>
                  {aclType === "standard"
                    ? "Standard ACLs filter based on source IP addresses only (1-99, 1300-1999)"
                    : "Extended ACLs filter based on source, destination, protocol, and ports (100-199, 2000-2699)"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="acl-name">ACL Name/Number</Label>
                    <Input
                      id="acl-name"
                      value={aclName}
                      onChange={(e) => setAclName(e.target.value)}
                      placeholder={aclType === "standard" ? "10" : "101"}
                    />
                  </div>
                  <div>
                    <Label>Platform</Label>
                    <Select value={platform} onValueChange={setPlatform}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cisco-ios">Cisco IOS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button onClick={loadSampleRules} variant="outline" className="flex-1">
                    Load Sample Rules
                  </Button>
                  <Button onClick={validateAllRules} variant="outline" className="flex-1">
                    <CheckCircle className="mr-2 h-4 w-4" />
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
                    <Badge variant="secondary">{currentRules.length} rules</Badge>
                    <Button
                      onClick={aclType === "standard" ? addStandardRule : addExtendedRule}
                      size="sm"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Rule
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 space-y-4 overflow-y-auto">
                  {currentRules.map((rule, index) => {
                    const validation = validationResults[index]
                    return (
                      <div key={rule.id} className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">Rule {index + 1}</Badge>
                            {validation && (
                              <>
                                {validation.isValid ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-red-600" />
                                )}
                              </>
                            )}
                          </div>
                          <Button
                            onClick={() =>
                              aclType === "standard"
                                ? deleteStandardRule(rule.id)
                                : deleteExtendedRule(rule.id)
                            }
                            size="sm"
                            variant="ghost"
                            className="text-destructive h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

                        {aclType === "standard" ? (
                          // Standard ACL Rule Form
                          <TabsContent value="standard" className="mt-0 space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label>Action</Label>
                                <Select
                                  value={rule.action}
                                  onValueChange={(value) =>
                                    updateStandardRule(rule.id, "action", value)
                                  }
                                >
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
                                <Label>Source Network</Label>
                                <Input
                                  value={(rule as StandardACLRule).sourceNetwork}
                                  onChange={(e) =>
                                    updateStandardRule(rule.id, "sourceNetwork", e.target.value)
                                  }
                                  placeholder="192.168.1.0/24, host 1.1.1.1, or any"
                                />
                              </div>
                            </div>
                            <div>
                              <Label>Description</Label>
                              <Input
                                value={rule.description || ""}
                                onChange={(e) =>
                                  updateStandardRule(rule.id, "description", e.target.value)
                                }
                                placeholder="Rule description"
                              />
                            </div>
                          </TabsContent>
                        ) : (
                          // Extended ACL Rule Form
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label>Action</Label>
                                <Select
                                  value={rule.action}
                                  onValueChange={(value) =>
                                    updateExtendedRule(rule.id, "action", value)
                                  }
                                >
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
                                  value={(rule as ExtendedACLRule).protocol}
                                  onValueChange={(value) =>
                                    updateExtendedRule(rule.id, "protocol", value)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ip">IP (Any)</SelectItem>
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
                                  value={(rule as ExtendedACLRule).sourceNetwork}
                                  onChange={(e) =>
                                    updateExtendedRule(rule.id, "sourceNetwork", e.target.value)
                                  }
                                  placeholder="10.0.0.0/24, host 1.1.1.1, or any"
                                />
                              </div>
                              <div>
                                <Label>Destination Network</Label>
                                <Input
                                  value={(rule as ExtendedACLRule).destNetwork}
                                  onChange={(e) =>
                                    updateExtendedRule(rule.id, "destNetwork", e.target.value)
                                  }
                                  placeholder="192.168.1.0/24, host 1.1.1.1, or any"
                                />
                              </div>
                            </div>

                            {((rule as ExtendedACLRule).protocol === "tcp" ||
                              (rule as ExtendedACLRule).protocol === "udp") && (
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label>Destination Port</Label>
                                  <div className="flex gap-1">
                                    <Select
                                      value={(rule as ExtendedACLRule).destPortOperator || "eq"}
                                      onValueChange={(value) =>
                                        updateExtendedRule(rule.id, "destPortOperator", value)
                                      }
                                    >
                                      <SelectTrigger className="w-20">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="eq">eq</SelectItem>
                                        <SelectItem value="gt">gt</SelectItem>
                                        <SelectItem value="lt">lt</SelectItem>
                                        <SelectItem value="neq">neq</SelectItem>
                                        <SelectItem value="range">range</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      value={
                                        (rule as ExtendedACLRule).destPortOperator === "range"
                                          ? (rule as ExtendedACLRule).destPortRange || ""
                                          : (rule as ExtendedACLRule).destPort || ""
                                      }
                                      onChange={(e) =>
                                        updateExtendedRule(
                                          rule.id,
                                          (rule as ExtendedACLRule).destPortOperator === "range"
                                            ? "destPortRange"
                                            : "destPort",
                                          e.target.value
                                        )
                                      }
                                      placeholder={
                                        (rule as ExtendedACLRule).destPortOperator === "range"
                                          ? "80-90"
                                          : "443"
                                      }
                                      className="flex-1"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`established-${rule.id}`}
                                      checked={(rule as ExtendedACLRule).established || false}
                                      onCheckedChange={(checked) =>
                                        updateExtendedRule(rule.id, "established", !!checked)
                                      }
                                    />
                                    <Label htmlFor={`established-${rule.id}`} className="text-sm">
                                      Established
                                    </Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`log-${rule.id}`}
                                      checked={(rule as ExtendedACLRule).log || false}
                                      onCheckedChange={(checked) =>
                                        updateExtendedRule(rule.id, "log", !!checked)
                                      }
                                    />
                                    <Label htmlFor={`log-${rule.id}`} className="text-sm">
                                      Log
                                    </Label>
                                  </div>
                                </div>
                              </div>
                            )}

                            {(rule as ExtendedACLRule).protocol === "icmp" && (
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label>ICMP Type</Label>
                                  <Input
                                    value={(rule as ExtendedACLRule).icmpType || ""}
                                    onChange={(e) =>
                                      updateExtendedRule(rule.id, "icmpType", e.target.value)
                                    }
                                    placeholder="8 (echo)"
                                  />
                                </div>
                                <div>
                                  <Label>ICMP Code</Label>
                                  <Input
                                    value={(rule as ExtendedACLRule).icmpCode || ""}
                                    onChange={(e) =>
                                      updateExtendedRule(rule.id, "icmpCode", e.target.value)
                                    }
                                    placeholder="0"
                                  />
                                </div>
                              </div>
                            )}

                            <div>
                              <Label>Description</Label>
                              <Input
                                value={rule.description || ""}
                                onChange={(e) =>
                                  updateExtendedRule(rule.id, "description", e.target.value)
                                }
                                placeholder="Rule description"
                              />
                            </div>
                          </div>
                        )}
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
                  <FileText className="h-5 w-5" />
                  <span>Generated Configuration</span>
                </CardTitle>
                <CardDescription>
                  Copy this {aclType} ACL configuration to your Cisco IOS device
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={generateACL()}
                  readOnly
                  className="min-h-[400px] font-mono text-sm"
                />
                <div className="mt-4 flex space-x-2">
                  <Button onClick={copyToClipboard} variant="outline" className="flex-1">
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                  <Button onClick={exportACL} variant="outline" className="flex-1">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {aclType === "standard" ? "Standard ACL" : "Extended ACL"} Reference
                </CardTitle>
              </CardHeader>
              <CardContent>
                {aclType === "standard" ? (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-lg p-4">
                      <h4 className="mb-2 font-semibold">Standard ACL Numbers</h4>
                      <div className="text-muted-foreground space-y-1 text-sm">
                        <p>
                          • <strong>1-99:</strong> Standard IP ACLs
                        </p>
                        <p>
                          • <strong>1300-1999:</strong> Extended standard IP ACLs
                        </p>
                        <p>
                          • <strong>Best Practice:</strong> Apply close to destination
                        </p>
                        <p>
                          • <strong>Filters:</strong> Source IP addresses only
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-4 font-medium">
                        <span>Syntax</span>
                        <span>Example</span>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-4">
                        <span className="font-mono">any</span>
                        <span>All addresses</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <span className="font-mono">host x.x.x.x</span>
                        <span>Single host</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <span className="font-mono">x.x.x.x y.y.y.y</span>
                        <span>Network + wildcard</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-lg p-4">
                      <h4 className="mb-2 font-semibold">Extended ACL Numbers</h4>
                      <div className="text-muted-foreground space-y-1 text-sm">
                        <p>
                          • <strong>100-199:</strong> Extended IP ACLs
                        </p>
                        <p>
                          • <strong>2000-2699:</strong> Extended extended IP ACLs
                        </p>
                        <p>
                          • <strong>Best Practice:</strong> Apply close to source
                        </p>
                        <p>
                          • <strong>Filters:</strong> Source, destination, protocol, ports
                        </p>
                      </div>
                    </div>
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
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </Tabs>
    </div>
  )
}
