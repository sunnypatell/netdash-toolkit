"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

const ResponsiveTabs = TabsPrimitive.Root

const ResponsiveTabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      // Mobile: flex wrap with pill-style buttons
      "flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0",
      // SM+: grid layout with standard tab styling
      "sm:bg-muted sm:text-muted-foreground sm:grid sm:h-10 sm:gap-0 sm:rounded-md sm:p-1",
      className
    )}
    {...props}
  />
))
ResponsiveTabsList.displayName = "ResponsiveTabsList"

const ResponsiveTabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // Mobile: pill-style buttons
      "border-input bg-muted ring-offset-background inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all",
      "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
      "disabled:pointer-events-none disabled:opacity-50",
      "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      // SM+: standard tab styling
      "sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm",
      className
    )}
    {...props}
  />
))
ResponsiveTabsTrigger.displayName = "ResponsiveTabsTrigger"

const ResponsiveTabsContent = TabsPrimitive.Content

export { ResponsiveTabs, ResponsiveTabsList, ResponsiveTabsTrigger, ResponsiveTabsContent }
