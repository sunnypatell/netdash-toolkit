// @ts-check
import { defineConfig } from "astro/config"
import starlight from "@astrojs/starlight"

// https://astro.build/config
export default defineConfig({
  site: "https://netdash-toolkit.vercel.app",
  base: "/docs",
  integrations: [
    starlight({
      title: "NetDash Toolkit",
      description:
        "Documentation for NetDash Toolkit: 48 network engineering tools that run in your browser, plus a desktop build that does real ICMP, traceroute and TCP scanning.",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/sunnypatell/netdash-toolkit",
        },
        {
          // relative on purpose: the same build is served from vercel and from the
          // desktop app's local http server, so a hardcoded origin would send
          // offline desktop users to the internet.
          icon: "external",
          label: "Open the app",
          href: "/",
        },
      ],
      customCss: ["./src/styles/custom.css"],
      editLink: {
        baseUrl: "https://github.com/sunnypatell/netdash-toolkit/edit/main/docs/",
      },
      head: [
        {
          // the site title otherwise links to /docs/ and traps you inside the docs
          tag: "script",
          content:
            "document.addEventListener('DOMContentLoaded',function(){var a=document.querySelector('.site-title');if(a)a.href='/';});",
        },
      ],
      sidebar: [
        {
          label: "Getting started",
          items: [
            { label: "What NetDash Toolkit is", slug: "getting-started/introduction" },
            { label: "Browser versus desktop", slug: "getting-started/browser-versus-desktop" },
            { label: "Quick start", slug: "getting-started/quick-start" },
          ],
        },
        {
          label: "Tools",
          items: [
            { label: "Calculators", slug: "tools/calculators" },
            { label: "IP Tools", slug: "tools/ip-tools" },
            { label: "Network Config", slug: "tools/network" },
            { label: "Diagnostics", slug: "tools/diagnostics" },
            { label: "Generators", slug: "tools/generators" },
            { label: "Reference", slug: "tools/reference" },
            { label: "Dev Tools", slug: "tools/devtools" },
          ],
        },
        {
          label: "How the diagnostics work",
          items: [
            { label: "What a browser cannot do", slug: "diagnostics/browser-limits" },
            { label: "DNS over HTTPS", slug: "diagnostics/dns-over-https" },
            { label: "Desktop-only capabilities", slug: "diagnostics/desktop-capabilities" },
            { label: "Address math, walked through", slug: "diagnostics/address-math" },
          ],
        },
        {
          label: "Accessibility",
          items: [
            {
              // owned by a separate conformance record, linked rather than slugged so
              // this build does not depend on that file landing first. starlight
              // prefixes `base` onto a sidebar link, so this must NOT start with /docs.
              label: "WCAG 2.2 AA conformance record",
              link: "/accessibility-conformance/",
            },
          ],
        },
        {
          label: "Privacy and data handling",
          items: [
            { label: "What leaves your device", slug: "privacy/what-leaves-your-device" },
            { label: "Accounts and saved projects", slug: "privacy/accounts-and-projects" },
          ],
        },
        {
          label: "Self-hosting and desktop",
          items: [
            { label: "Local development", slug: "self-hosting/local-development" },
            { label: "Building the desktop app", slug: "self-hosting/desktop-build" },
            { label: "Releases and verification", slug: "self-hosting/releases" },
          ],
        },
        {
          label: "Contributing",
          items: [
            { label: "Repository layout", slug: "contributing/repository-layout" },
            { label: "Tests and gates", slug: "contributing/tests-and-gates" },
            { label: "Code conventions", slug: "contributing/conventions" },
          ],
        },
      ],
      lastUpdated: true,
      pagination: true,
    }),
  ],
})
