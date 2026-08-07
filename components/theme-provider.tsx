"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Provider = NextThemesProvider as any

export function ThemeProvider({
  children,
  ...props
}: {
  children: React.ReactNode
  [key: string]: unknown
}) {
  // disableTransitionOnChange is load-bearing: the ui transitions colours on hover, so every one fires at once on toggle
  return (
    <Provider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </Provider>
  )
}
