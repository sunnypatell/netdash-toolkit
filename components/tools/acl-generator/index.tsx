"use client"

import { useMemo, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Network, Settings, Shield } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { LoadFromProject } from "@/components/ui/load-from-project"
import { SaveToProject } from "@/components/ui/save-to-project"
import { copyText } from "@/lib/clipboard"
import { dateStamp, downloadTextFile } from "@/lib/download"
import { toast } from "sonner"
import {
  generateACL,
  SAMPLE_EXTENDED_RULES,
  SAMPLE_STANDARD_RULES,
  type ACLPlatform,
  type ACLType,
  type ExtendedACLRule,
  type StandardACLRule,
} from "@/lib/acl"
import { ExtendedACLPanel } from "./extended"
import { StandardACLPanel } from "./standard"

const DEFAULT_NAME: Record<ACLType, string> = { standard: "10", extended: "101" }

export function ACLGenerator() {
  const [aclType, setAclType] = useState<ACLType>("extended")
  const [standardRules, setStandardRules] = useState<StandardACLRule[]>([SAMPLE_STANDARD_RULES[0]])
  const [extendedRules, setExtendedRules] = useState<ExtendedACLRule[]>([SAMPLE_EXTENDED_RULES[0]])
  const [aclName, setAclName] = useState(DEFAULT_NAME.extended)
  const [nameEdited, setNameEdited] = useState(false)
  const [platform, setPlatform] = useState<ACLPlatform>("cisco-ios")

  // the generator embeds a timestamp, so memoize it or the readonly textarea
  // rewrites itself on every keystroke elsewhere in the tool
  const config = useMemo(
    () => generateACL({ aclType, aclName, platform, standardRules, extendedRules }),
    [aclType, aclName, platform, standardRules, extendedRules]
  )

  const handleTypeChange = (value: string) => {
    const type = value as ACLType
    setAclType(type)
    // an untouched extended number is invalid on a standard acl, so follow the tab
    if (!nameEdited) setAclName(DEFAULT_NAME[type])
  }

  const handleAclNameChange = (value: string) => {
    setNameEdited(true)
    setAclName(value)
  }

  const copyConfig = async () => {
    if (await copyText(config)) {
      toast.success("Copied to clipboard")
    } else {
      toast.error("Could not copy to clipboard")
    }
  }

  const exportConfig = () => {
    downloadTextFile(config, `acl-${aclName}-${aclType}-${platform}-${dateStamp()}.txt`)
  }

  const handleLoadFromProject = (data: Record<string, unknown>) => {
    const savedAclName = data.aclName as string | undefined
    const savedAclType = data.aclType as ACLType | undefined
    const savedPlatform = data.platform as ACLPlatform | undefined
    const savedRules = data.rules as StandardACLRule[] | ExtendedACLRule[] | undefined

    if (savedAclName) {
      setAclName(savedAclName)
      setNameEdited(true)
    }
    if (savedAclType) {
      setAclType(savedAclType)
      if (savedRules) {
        if (savedAclType === "standard") {
          setStandardRules(savedRules as StandardACLRule[])
        } else {
          setExtendedRules(savedRules as ExtendedACLRule[])
        }
      }
    }
    if (savedPlatform) {
      setPlatform(savedPlatform)
    }
  }

  const saveAction = (
    <SaveToProject
      itemType="acl"
      itemName={`ACL ${aclName} (${aclType})`}
      itemData={{
        aclName,
        aclType,
        platform,
        rules: aclType === "standard" ? standardRules : extendedRules,
        generatedConfig: config,
      }}
      toolSource="ACL Generator"
      className="flex-1"
    />
  )

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Shield}
        title="Enhanced ACL Generator"
        description="Generate Standard and Extended Access Control Lists with advanced features and validation"
        actions={<LoadFromProject itemType="acl" onLoad={handleLoadFromProject} />}
      />

      <Tabs value={aclType} onValueChange={handleTypeChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="standard" className="flex items-center gap-2">
            <Network className="h-4 w-4" aria-hidden="true" />
            Standard ACL
          </TabsTrigger>
          <TabsTrigger value="extended" className="flex items-center gap-2">
            <Settings className="h-4 w-4" aria-hidden="true" />
            Extended ACL
          </TabsTrigger>
        </TabsList>

        {/* one panel keyed to the active type: without it the selected tab's
            aria-controls pointed at an element that does not exist */}
        <TabsContent value={aclType} className="space-y-4">
          {aclType === "standard" ? (
            <StandardACLPanel
              aclName={aclName}
              platform={platform}
              rules={standardRules}
              config={config}
              onAclNameChange={handleAclNameChange}
              onPlatformChange={setPlatform}
              onRulesChange={setStandardRules}
              onCopy={copyConfig}
              onExport={exportConfig}
              saveAction={saveAction}
            />
          ) : (
            <ExtendedACLPanel
              aclName={aclName}
              platform={platform}
              rules={extendedRules}
              config={config}
              onAclNameChange={handleAclNameChange}
              onPlatformChange={setPlatform}
              onRulesChange={setExtendedRules}
              onCopy={copyConfig}
              onExport={exportConfig}
              saveAction={saveAction}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
