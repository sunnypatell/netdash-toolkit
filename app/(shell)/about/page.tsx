import type { Metadata } from "next"
import { canonical } from "@/lib/site"
import { About } from "@/components/about"

export const metadata: Metadata = {
  title: "About",
  description: "What NetDash Toolkit is, how it works, and what ships in each release",
  // without its own canonical this inherits the root layout's, which points at "/" and folds the page into the homepage
  alternates: { canonical: canonical("/about") },
  openGraph: {
    title: "About",
    description: "What NetDash Toolkit is, how it works, and what ships in each release",
    url: canonical("/about"),
  },
}

export default function AboutPage() {
  return <About />
}
