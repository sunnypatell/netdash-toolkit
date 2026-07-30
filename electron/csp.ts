// content-security-policy for the packaged desktop build, kept as data in its
// own module so it can be asserted in tests without launching electron (same
// reason navigation.ts is separate).
//
// the desktop renderer runs the identical next static export the website does,
// so the directive content matches vercel.json exactly; 'self' just resolves to
// http://localhost:<staticPort> here instead of the deployed https origin.
// tests/unit/csp.test.ts asserts that equality and derives the egress list from
// the source, so a new third-party call fails ci instead of failing users.

export type CspDirectives = Record<string, string[]>

export const CSP_DIRECTIVES: CspDirectives = {
  "default-src": ["'self'"],
  // a static export inlines hydration scripts and has no per-request nonce, so
  // 'unsafe-inline' is the ceiling here. apis.google.com is firebase auth's gapi
  // loader, accounts.google.com is google identity services (one tap).
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    "https://apis.google.com",
    "https://accounts.google.com",
  ],
  "style-src": ["'self'", "'unsafe-inline'"],
  // https: because a signed-in user can point photoURL at any avatar host
  "img-src": ["'self'", "data:", "https:"],
  "font-src": ["'self'", "data:"],
  // not an allowlist on purpose: the network tester, port scanner, ping fallback
  // and tls trust probe all fetch a host the user types. see SECURITY.md.
  "connect-src": ["'self'", "https:", "http:"],
  // firebase auth's __/auth/iframe plus the google sign-in frame
  "frame-src": ["https://*.firebaseapp.com", "https://accounts.google.com"],
  // the regex tester evaluates user patterns in a blob worker
  "worker-src": ["'self'", "blob:"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
}

export function serializeCsp(directives: CspDirectives): string {
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ")
}

export const CONTENT_SECURITY_POLICY = serializeCsp(CSP_DIRECTIVES)
