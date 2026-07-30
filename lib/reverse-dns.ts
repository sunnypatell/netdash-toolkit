import { expandIPv6, isValidIPv4, isValidIPv6 } from "./network-utils"

// a PTR record does not live at the address. rfc 1035 3.5 puts ipv4 reverse
// mappings under IN-ADDR.ARPA with the octets reversed, and rfc 3596 2.5 puts
// ipv6 under IP6.ARPA as reversed nibbles. querying PTR for "8.8.8.8" verbatim
// asks for a name that does not exist and comes back NXDOMAIN.
export function reverseDnsName(input: string): string | null {
  const address = input.trim()
  if (isValidIPv4(address)) {
    return `${address.split(".").reverse().join(".")}.in-addr.arpa`
  }
  if (isValidIPv6(address)) {
    const nibbles = expandIPv6(address).replace(/:/g, "").toLowerCase()
    if (nibbles.length !== 32) return null
    return `${nibbles.split("").reverse().join(".")}.ip6.arpa`
  }
  return null
}

// true when the user typed an address rather than a name, so a PTR query needs
// rewriting before it is sent
export function looksLikeIpAddress(input: string): boolean {
  const address = input.trim()
  return isValidIPv4(address) || isValidIPv6(address)
}

// the name actually sent to the resolver for a given query, plus whether it was
// rewritten, so the ui can show what was asked rather than what was typed
export function resolveQueryName(
  input: string,
  recordType: string
): { name: string; rewrittenFrom?: string } {
  const trimmed = input.trim()
  if (recordType.toUpperCase() !== "PTR") return { name: trimmed }
  const reverse = reverseDnsName(trimmed)
  if (!reverse || reverse === trimmed) return { name: trimmed }
  return { name: reverse, rewrittenFrom: trimmed }
}
