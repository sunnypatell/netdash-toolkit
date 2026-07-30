import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-[3px] aria-invalid:ring-destructive dark:aria-invalid:ring-destructive aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        // a linked badge focuses, and the ring is its only indicator, so full alpha
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive dark:bg-destructive/60",
        outline: "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentPropsWithoutRef<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  // a badge with a click handler is a button. rendering it as a span left eight
  // call sites unreachable by keyboard (2.1.1) and roleless (4.1.2), and the
  // 22px text box under the 24px target floor (2.5.8).
  const interactive = !asChild && typeof props.onClick === "function"
  const Comp: React.ElementType = asChild ? Slot : interactive ? "button" : "span"

  return (
    <Comp
      data-slot="badge"
      {...(interactive ? { type: "button" } : {})}
      className={cn(badgeVariants({ variant }), interactive && "min-h-6 cursor-pointer", className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
