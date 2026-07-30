"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { copyText } from "@/lib/clipboard"

interface CopyButtonProps {
  value: string
  className?: string
  variant?: "default" | "ghost" | "outline" | "secondary" | "destructive" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

export function CopyButton({ value, className, variant = "ghost", size = "sm" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  // copyText, not navigator.clipboard directly: the helper carries the
  // execCommand fallback for non-secure contexts, and 22 tools reach the
  // clipboard through this button
  const handleCopy = useCallback(async () => {
    if (!(await copyText(value))) return
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [value])

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        "transition-all duration-200",
        copied && "text-green-600 dark:text-green-400",
        className
      )}
      onClick={handleCopy}
      aria-label={copied ? "Copied!" : "Copy to clipboard"}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  )
}
