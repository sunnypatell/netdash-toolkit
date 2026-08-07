"use client"

import { useState, type ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
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
  SAMPLE_STANDARD_RULES,
  validateStandardRule,
  type ACLPlatform,
  type StandardACLRule,
  type ValidationResult,
} from "@/lib/acl"
import { nextId } from "@/lib/id"

export interface StandardACLPanelProps {
  aclName: string
  platform: ACLPlatform
  rules: StandardACLRule[]
  config: string
  onAclNameChange: (value: string) => void
  onPlatformChange: (value: ACLPlatform) => void
  onRulesChange: (rules: StandardACLRule[]) => void
  onExport: () => void
  saveAction?: ReactNode
}

export function StandardACLPanel({
  aclName,
  platform,
  rules,
  config,
  onAclNameChange,
  onPlatformChange,
  onRulesChange,
  onExport,
  saveAction,
}: StandardACLPanelProps) {
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([])

  const updateRule = (id: string, field: keyof StandardACLRule, value: string) => {
    onRulesChange(rules.map((rule) => (rule.id === id ? { ...rule, [field]: value } : rule)))
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <ACLConfigCard
          aclType="standard"
          idPrefix="acl-std"
          aclName={aclName}
          platform={platform}
          onAclNameChange={onAclNameChange}
          onPlatformChange={onPlatformChange}
          onLoadSample={() => {
            onRulesChange(SAMPLE_STANDARD_RULES)
            setValidationResults([])
          }}
          onValidate={() => setValidationResults(rules.map(validateStandardRule))}
        />

        <RulesCard
          count={rules.length}
          onAdd={() =>
            onRulesChange([
              ...rules,
              { id: nextId("acl"), action: "permit", sourceNetwork: "any", description: "" },
            ])
          }
        >
          {rules.map((rule, index) => {
            const validation = validationResults[index]
            // rule-level: every error this rule can raise comes from its source network
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
                      <Label htmlFor={`acl-std-action-${rule.id}`}>Action</Label>
                      <Select
                        value={rule.action}
                        onValueChange={(value) => updateRule(rule.id, "action", value)}
                      >
                        <SelectTrigger id={`acl-std-action-${rule.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="permit">Permit</SelectItem>
                          <SelectItem value="deny">Deny</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`acl-std-source-${rule.id}`}>Source Network</Label>
                      <Input
                        id={`acl-std-source-${rule.id}`}
                        value={rule.sourceNetwork}
                        onChange={(e) => updateRule(rule.id, "sourceNetwork", e.target.value)}
                        placeholder="192.168.1.0/24, host 1.1.1.1, or any"
                        aria-invalid={ruleInvalid}
                        aria-describedby={ruleDescribedBy}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={`acl-std-description-${rule.id}`}>Description</Label>
                    <Input
                      id={`acl-std-description-${rule.id}`}
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
          aclType="standard"
          platform={platform}
          config={config}
          onExport={onExport}
          saveAction={saveAction}
        />

        <Card>
          <CardHeader>
            <CardTitle>Standard ACL Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="mb-2 font-semibold">Standard ACL Numbers</h4>
                <div className="text-muted-foreground space-y-1 text-sm">
                  <p>
                    • <strong>1-99:</strong> Standard IP ACLs
                  </p>
                  <p>
                    • <strong>1300-1999:</strong> Expanded standard IP ACLs
                  </p>
                  <p>
                    • <strong>Named:</strong> ip access-list standard NAME
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
                  <span className="font-mono break-all">any</span>
                  <span>All addresses</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <span className="font-mono break-all">host x.x.x.x</span>
                  <span>Single host</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <span className="font-mono break-all">x.x.x.x y.y.y.y</span>
                  <span>Network + wildcard</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
