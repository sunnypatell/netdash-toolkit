"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    // min-h-6: radix binds pointerdown on the root, so the root is the target
    // 2.5.8 measures. a 20px thumb would otherwise make it 20px tall.
    className={cn("relative flex min-h-6 w-full touch-none items-center select-none", className)}
    {...props}
  >
    <SliderPrimitive.Track className="bg-secondary relative h-2 w-full grow overflow-hidden rounded-full">
      <SliderPrimitive.Range className="bg-primary absolute h-full" />
    </SliderPrimitive.Track>
    {/* the thumb, not the root, is the element with role="slider", so the name
        has to land here or axe reports aria-input-field-name and screen readers
        announce an unnamed slider. callers label the Slider, so forward it. */}
    <SliderPrimitive.Thumb
      aria-label={props["aria-label"]}
      aria-labelledby={props["aria-labelledby"]}
      className="border-primary bg-background ring-offset-background focus-visible:ring-ring relative block h-5 w-5 rounded-full border-2 transition-colors before:absolute before:-inset-0.5 before:rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
    />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
