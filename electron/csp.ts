// data, not electron calls, so tests/unit/csp.test.ts can assert it. must stay byte-identical to
// vercel.json: only 'self' differs, resolving to http://localhost:<staticPort> here.

export type CspDirectives = Record<string, string[]>

export const CSP_DIRECTIVES: CspDirectives = {
  "default-src": ["'self'"],
  // a static export has no per-request nonce, so 'unsafe-inline' is the ceiling; 'wasm-unsafe-eval'
  // is pagefind's, since chromium gates wasm on script-src. see self-hosting/desktop-build.md.
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    "'wasm-unsafe-eval'",
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
