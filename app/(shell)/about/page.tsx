import type { Metadata } from "next"
import { About } from "@/components/about"

export const metadata: Metadata = {
  title: "About",
  description: "What NetDash Toolkit is, how it works, and what ships in each release",
}

export default function AboutPage() {
  return <About />
}
