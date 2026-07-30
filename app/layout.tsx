import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/contexts/auth-context"
import { ProjectProvider } from "@/contexts/project-context"
import { Analytics } from "@vercel/analytics/react"
import { Toaster } from "sonner"
import { Suspense } from "react"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { offlineToolCount, tools } from "@/lib/tool-registry"
import { REPO_URL, SITE_NAME, SITE_TAGLINE, SITE_URL, canonical } from "@/lib/site"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
})

export const metadata: Metadata = {
  // without metadataBase, every og:image and canonical resolves relative and
  // breaks the moment a card is rendered off-site
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME}: ${SITE_TAGLINE}`,
    // per-tool pages supply their own title and inherit the suffix
    template: `%s | ${SITE_NAME}`,
  },
  description: `${tools.length} network engineering tools: subnetting, DNS, TLS, packet maths and reference tables. Free, no account required, and ${offlineToolCount()} of them never send your input anywhere.`,
  applicationName: SITE_NAME,
  authors: [{ name: "Sunny Patel", url: "https://sunnypatel.net" }],
  creator: "Sunny Patel",
  keywords: [
    "network engineering",
    "subnet calculator",
    "cidr",
    "dns lookup",
    "network tools",
    "ipv6",
    "vlsm",
  ],
  alternates: { canonical: canonical("/") },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME}: ${SITE_TAGLINE}`,
    description: `${tools.length} network engineering tools. Free, no account required.`,
    url: canonical("/"),
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME}: ${SITE_TAGLINE}`,
    description: `${tools.length} network engineering tools. Free, no account required.`,
  },
  robots: { index: true, follow: true },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icon.svg",
  },
}

export const viewport: Viewport = {
  // both values are the real --background tokens, so the browser chrome matches
  // the painted page instead of flashing a default
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans ${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        <script
          type="application/ld+json"
          // no ratings, no review counts, no publisher organisation: only claims
          // that are verifiably true of this app
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: SITE_NAME,
              description: SITE_TAGLINE,
              url: canonical("/"),
              applicationCategory: "DeveloperApplication",
              operatingSystem: "Any",
              browserRequirements: "Requires JavaScript",
              isAccessibleForFree: true,
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              author: { "@type": "Person", name: "Sunny Patel", url: "https://sunnypatel.net" },
              codeRepository: REPO_URL,
              license: "https://opensource.org/licenses/MIT",
            }),
          }}
        />
        <Suspense fallback={null}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <NuqsAdapter>
              <AuthProvider>
                <ProjectProvider>{children}</ProjectProvider>
              </AuthProvider>
            </NuqsAdapter>
            {/* the app had two toast systems and mounted neither, so every
                "copied"/"saved"/"failed" message was silent. one system now. */}
            <Toaster richColors closeButton position="bottom-right" />
          </ThemeProvider>
        </Suspense>
        <Analytics />
      </body>
    </html>
  )
}
