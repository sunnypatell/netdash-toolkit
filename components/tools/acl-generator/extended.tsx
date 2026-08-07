"use client"

import { useState, type ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ACLConfigCard } from "./config-card"
import { ACLOutputCard } from "./output-card"
import { RuleShell, RulesCard } from "./rule-list"
import {
  SAMPLE_EXTENDED_RULES,
  validateExtendedRule,
  type ACLPlatform,
  type ExtendedACLRule,
  type ValidationResult,
} from "@/lib/acl"
import { nextId } from "@/lib/id"

const COMMON_PORTS = [
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
]

export interface ExtendedACLPanelProps {
  aclName: string
  platform: ACLPlatform
  rules: ExtendedACLRule[]
  config: string
  onAclNameChange: (value: string) => void
  onPlatformChange: (value: ACLPlatform) => void
  onRulesChange: (rules: ExtendedACLRule[]) => void
  onExport: () => void
  saveAction?: ReactNode
}

export function ExtendedACLPanel({
  aclName,
  platform,
  rules,
  config,
  onAclNameChange,
  onPlatformChange,
  onRulesChange,
  onExport,
  saveAction,
}: ExtendedACLPanelProps) {
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([])

  const updateRule = (
    id: string,
    field: keyof ExtendedACLRule,
    value: string | boolean | string[]
  ) => {
    onRulesChange(rules.map((rule) => (rule.id === id ? { ...rule, [field]: value } : rule)))
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <ACLConfigCard
          aclType="extended"
          idPrefix="acl-ext"
          aclName={aclName}
          platform={platform}
          onAclNameChange={onAclNameChange}
          onPlatformChange={onPlatformChange}
          onLoadSample={() => {
            onRulesChange(SAMPLE_EXTENDED_RULES)
            setValidationResults([])
          }}
          onValidate={() => setValidationResults(rules.map(validateExtendedRule))}
        />

        <RulesCard
          count={rules.length}
          onAdd={() =>
            onRulesChange([
              ...rules,
              {
                id: nextId("acl"),
                action: "permit",
                protocol: "tcp",
                sourceNetwork: "any",
                destNetwork: "any",
                destPortOperator: "eq",
                sourcePortOperator: "eq",
                description: "",
              },
            ])
          }
        >
          {rules.map((rule, index) => {
            const validation = validationResults[index]
            // rule-level: the message lists every error the rule raised, so the fields
            // that can raise one all point at it
            const ruleInvalid = Boolean(validation && !validation.isValid)
            const ruleDescribedBy = ruleInvalid ? `acl-rule-${index}-error` : undefined
            return (
              <RuleShell
                key={rule.id}
                index={index}
                validation={validation}
                onDelete={() => onRulesChange(rules.filter((r) => r.id !== rule.id))}
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor={`acl-ext-action-${rule.id}`}>Action</Label>
                      <Select
                        value={rule.action}
                        onValueChange={(value) => updateRule(rule.id, "action", value)}
                      >
                        <SelectTrigger id={`acl-ext-action-${rule.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="permit">Permit</SelectItem>
                          <SelectItem value="deny">Deny</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`acl-ext-protocol-${rule.id}`}>Protocol</Label>
                      <Select
                        value={rule.protocol}
                        onValueChange={(value) => updateRule(rule.id, "protocol", value)}
                      >
                        <SelectTrigger id={`acl-ext-protocol-${rule.id}`}>
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
                      <Label htmlFor={`acl-ext-source-${rule.id}`}>Source Network</Label>
                      <Input
                        id={`acl-ext-source-${rule.id}`}
                        value={rule.sourceNetwork}
                        onChange={(e) => updateRule(rule.id, "sourceNetwork", e.target.value)}
                        placeholder="10.0.0.0/24, host 1.1.1.1, or any"
                        aria-invalid={ruleInvalid}
                        aria-describedby={ruleDescribedBy}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`acl-ext-dest-${rule.id}`}>Destination Network</Label>
                      <Input
                        id={`acl-ext-dest-${rule.id}`}
                        value={rule.destNetwork}
                        onChange={(e) => updateRule(rule.id, "destNetwork", e.target.value)}
                        placeholder="192.168.1.0/24, host 1.1.1.1, or any"
                        aria-invalid={ruleInvalid}
                        aria-describedby={ruleDescribedBy}
                      />
                    </div>
                  </div>

                  {(rule.protocol === "tcp" || rule.protocol === "udp") && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor={`acl-ext-dest-port-${rule.id}`}>Destination Port</Label>
                        <div className="flex gap-1">
                          <Select
                            value={rule.destPortOperator || "eq"}
                            onValueChange={(value) =>
                              updateRule(rule.id, "destPortOperator", value)
                            }
                          >
                            {/* operator has no visible label of its own */}
                            <SelectTrigger
                              className="w-20"
                              id={`acl-ext-dest-port-operator-${rule.id}`}
                              aria-label={`Destination port operator for rule ${index + 1}`}
                            >
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
                            id={`acl-ext-dest-port-${rule.id}`}
                            value={
                              rule.destPortOperator === "range"
                                ? rule.destPortRange || ""
                                : rule.destPort || ""
                            }
                            onChange={(e) =>
                              updateRule(
                                rule.id,
                                rule.destPortOperator === "range" ? "destPortRange" : "destPort",
                                e.target.value
                              )
                            }
                            placeholder={rule.destPortOperator === "range" ? "80-90" : "443"}
                            className="flex-1"
                            aria-invalid={ruleInvalid}
                            aria-describedby={ruleDescribedBy}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`acl-ext-established-${rule.id}`}
                            checked={rule.established || false}
                            onCheckedChange={(checked) =>
                              updateRule(rule.id, "established", !!checked)
                            }
                          />
                          <Label htmlFor={`acl-ext-established-${rule.id}`} className="text-sm">
                            Established
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`acl-ext-log-${rule.id}`}
                            checked={rule.log || false}
                            onCheckedChange={(checked) => updateRule(rule.id, "log", !!checked)}
                          />
                          <Label htmlFor={`acl-ext-log-${rule.id}`} className="text-sm">
                            Log
                          </Label>
                        </div>
                      </div>
                    </div>
                  )}

                  {rule.protocol === "icmp" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor={`acl-ext-icmp-type-${rule.id}`}>ICMP Type</Label>
                        <Input
                          id={`acl-ext-icmp-type-${rule.id}`}
                          value={rule.icmpType || ""}
                          onChange={(e) => updateRule(rule.id, "icmpType", e.target.value)}
                          placeholder="8 (echo)"
                          aria-invalid={ruleInvalid}
                          aria-describedby={ruleDescribedBy}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`acl-ext-icmp-code-${rule.id}`}>ICMP Code</Label>
                        <Input
                          id={`acl-ext-icmp-code-${rule.id}`}
                          value={rule.icmpCode || ""}
                          onChange={(e) => updateRule(rule.id, "icmpCode", e.target.value)}
                          placeholder="0"
                          aria-invalid={ruleInvalid}
                          aria-describedby={ruleDescribedBy}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor={`acl-ext-description-${rule.id}`}>Description</Label>
                    <Input
                      id={`acl-ext-description-${rule.id}`}
                      value={rule.description || ""}
                      onChange={(e) => updateRule(rule.id, "description", e.target.value)}
                      placeholder="Rule description"
                    />
                  </div>
                </div>
              </RuleShell>
            )
          })}
        </RulesCard>
      </div>

      <div className="space-y-4">
        <ACLOutputCard
          aclType="extended"
          platform={platform}
          config={config}
          onExport={onExport}
          saveAction={saveAction}
        />

        <Card>
          <CardHeader>
            <CardTitle>Extended ACL Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="mb-2 font-semibold">Extended ACL Numbers</h4>
                <div className="text-muted-foreground space-y-1 text-sm">
                  <p>
                    • <strong>100-199:</strong> Extended IP ACLs
                  </p>
                  <p>
                    • <strong>2000-2699:</strong> Expanded extended IP ACLs
                  </p>
                  <p>
                    • <strong>Named:</strong> ip access-list extended NAME
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
                {COMMON_PORTS.map(({ port, service }) => (
                  <div key={port} className="flex justify-between">
                    <span className="font-mono break-all">{port}</span>
                    <span className="text-muted-foreground">{service}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
