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
  // Ensure consistent theming by defaulting to class-based dark mode
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
