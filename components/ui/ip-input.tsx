"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { isValidIPv4, isValidIPv6, isValidCIDR } from "@/lib/network-utils"
import { cn } from "@/lib/utils"

interface IPInputProps {
  label?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  allowCIDR?: boolean
  ipVersion?: "ipv4" | "ipv6" | "both"
  className?: string
}

export function IPInput({
  label,
  placeholder,
  value,
  onChange,
  allowCIDR = false,
  ipVersion = "both",
  className,
}: IPInputProps) {
  const [isValid, setIsValid] = useState(true)
  const [addressType, setAddressType] = useState<string>("")

  const isPrefixInput = label?.toLowerCase().includes("prefix")

  useEffect(() => {
    if (!value) {
      setIsValid(true)
      setAddressType("")
      return
    }

    let valid = false
    let type = ""

    if (isPrefixInput) {
      const prefix = Number.parseInt(value)
      if (!isNaN(prefix)) {
        if (ipVersion === "ipv4" && prefix >= 0 && prefix <= 32) {
          valid = true
          type = "IPv4 Prefix"
        } else if (ipVersion === "ipv6" && prefix >= 0 && prefix <= 128) {
          valid = true
          type = "IPv6 Prefix"
        } else if (ipVersion === "both" && prefix >= 0 && prefix <= 128) {
          valid = true
          type = prefix <= 32 ? "IPv4/IPv6 Prefix" : "IPv6 Prefix"
        }
      }
    } else {
      if (allowCIDR && value.includes("/")) {
        valid = isValidCIDR(value)
        if (valid) {
          const [ip] = value.split("/")
          if (isValidIPv4(ip)) {
            type = "IPv4 CIDR"
          } else if (isValidIPv6(ip)) {
            type = "IPv6 CIDR"
          }
        }
      } else {
        if ((ipVersion === "ipv4" || ipVersion === "both") && isValidIPv4(value)) {
          valid = true
          type = "IPv4"
        } else if ((ipVersion === "ipv6" || ipVersion === "both") && isValidIPv6(value)) {
          valid = true
          type = "IPv6"
        }
      }
    }

    setIsValid(valid)
    setAddressType(type)
  }, [value, allowCIDR, ipVersion, isPrefixInput])

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn("font-mono", !isValid && value && "border-destructive focus-visible:ring-destructive")}
          type={isPrefixInput ? "number" : "text"}
          min={isPrefixInput ? "0" : undefined}
          max={isPrefixInput ? (ipVersion === "ipv6" ? "128" : "32") : undefined}
        />
        {addressType && (
          <Badge
            variant={isValid ? "secondary" : "destructive"}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs"
          >
            {addressType}
          </Badge>
        )}
      </div>
      {!isValid && value && (
        <p className="text-sm text-destructive">
          {isPrefixInput
            ? `Invalid prefix length (must be 0-${ipVersion === "ipv6" ? "128" : ipVersion === "ipv4" ? "32" : "128"})`
            : `Invalid ${ipVersion === "both" ? "IP address" : ipVersion.toUpperCase()} format${allowCIDR ? " or CIDR notation" : ""}`}
        </p>
      )}
    </div>
  )
}
