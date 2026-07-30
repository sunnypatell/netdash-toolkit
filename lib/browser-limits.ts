// the hard limits a page runs into when it tries to measure the network. kept in
// one place, each one traceable to the spec that imposes it, so a tool can state
// what it could not measure instead of reporting a limit as a finding.

// fetch standard, "cors-safelisted response-header name": on a cross-origin
// response these seven are readable and nothing else is, unless the server names
// more in access-control-expose-headers. every other header reads as absent from
// script, which is not the same as being absent from the response.
export const CORS_SAFELISTED_RESPONSE_HEADERS = [
  "Cache-Control",
  "Content-Language",
  "Content-Length",
  "Content-Type",
  "Expires",
  "Last-Modified",
  "Pragma",
] as const

export function isCorsSafelistedResponseHeader(name: string): boolean {
  const key = name.toLowerCase()
  return CORS_SAFELISTED_RESPONSE_HEADERS.some((h) => h.toLowerCase() === key)
}

// fetch standard, "port blocking": a fetch to any of these ports fails before a
// packet leaves, whatever the port's real state is. next ships the same table
// (next/dist/lib/helpers/get-reserved-port) citing the same section.
export const BLOCKED_PORT_SERVICES: Record<number, string> = {
  1: "tcpmux",
  7: "echo",
  9: "discard",
  11: "systat",
  13: "daytime",
  15: "netstat",
  17: "qotd",
  19: "chargen",
  20: "ftp-data",
  21: "ftp",
  22: "ssh",
  23: "telnet",
  25: "smtp",
  37: "time",
  42: "name",
  43: "nicname",
  53: "domain",
  69: "tftp",
  77: "rje",
  79: "finger",
  87: "link",
  95: "supdup",
  101: "hostname",
  102: "iso-tsap",
  103: "gppitnp",
  104: "acr-nema",
  109: "pop2",
  110: "pop3",
  111: "sunrpc",
  113: "auth",
  115: "sftp",
  117: "uucp-path",
  119: "nntp",
  123: "ntp",
  135: "epmap",
  137: "netbios-ns",
  139: "netbios-ssn",
  143: "imap",
  161: "snmp",
  179: "bgp",
  389: "ldap",
  427: "svrloc",
  465: "submissions",
  512: "exec",
  513: "login",
  514: "shell",
  515: "printer",
  526: "tempo",
  530: "courier",
  531: "chat",
  532: "netnews",
  540: "uucp",
  548: "afp",
  554: "rtsp",
  556: "remotefs",
  563: "nntps",
  587: "submission",
  601: "syslog-conn",
  636: "ldaps",
  989: "ftps-data",
  990: "ftps",
  993: "imaps",
  995: "pop3s",
  1719: "h323gatestat",
  1720: "h323hostcall",
  1723: "pptp",
  2049: "nfs",
  3659: "apple-sasl",
  4045: "npp",
  5060: "sip",
  5061: "sips",
  6000: "x11",
  6566: "sane-port",
  6665: "ircu",
  6666: "ircu",
  6667: "ircu",
  6668: "ircu",
  6669: "ircu",
  6697: "ircs-u",
  10080: "amanda",
}

export function isBlockedPort(port: number): boolean {
  return port in BLOCKED_PORT_SERVICES
}

export function blockedPortService(port: number): string | undefined {
  return BLOCKED_PORT_SERVICES[port]
}

export function pageIsHttps(): boolean {
  return typeof window !== "undefined" && window.location.protocol === "https:"
}

// mixed content 4.1: a fetch to an a-priori insecure url from a secure context is
// blockable and never reaches the network, so offering it would fail opaquely
export function canFetchHttpScheme(): boolean {
  return !pageIsHttps()
}

export const HTTP_FROM_HTTPS_EXPLANATION =
  "This page is served over HTTPS, so the browser blocks plain http:// requests as mixed content before they leave. Use an https:// target, or the desktop app."
