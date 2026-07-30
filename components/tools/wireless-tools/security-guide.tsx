"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, CheckCircle, Shield } from "lucide-react"

const CHECKLIST = [
  { id: "wireless-check-wpa", label: "WPA3 or WPA2 enabled" },
  { id: "wireless-check-password", label: "Strong password configured" },
  { id: "wireless-check-admin-creds", label: "Default admin credentials changed" },
  { id: "wireless-check-wps", label: "WPS disabled" },
  { id: "wireless-check-firmware", label: "Firmware up to date" },
  { id: "wireless-check-guest", label: "Guest network separated" },
  { id: "wireless-check-mgmt", label: "Management interface secured" },
  { id: "wireless-check-logging", label: "Logging enabled" },
  { id: "wireless-check-audits", label: "Regular security audits" },
  { id: "wireless-check-rogue-ap", label: "Rogue AP monitoring" },
]

export function SecurityGuidePanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" aria-hidden="true" />
          Wireless Security Best Practices
        </CardTitle>
        <CardDescription>Comprehensive guide to securing your wireless network</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <h4 className="mb-2 font-semibold">Authentication Methods</h4>
              <div className="space-y-3">
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
                    <span className="font-medium">WPA3 (Recommended)</span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Latest security standard with improved encryption and protection against offline
                    attacks.
                  </p>
                </div>
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" aria-hidden="true" />
                    <span className="font-medium">WPA2 (Acceptable)</span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Widely supported and secure when properly configured with strong passwords.
                  </p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />
                    <span className="font-medium">WEP (Avoid)</span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Deprecated and easily cracked. Should never be used in production environments.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="mb-2 font-semibold">Password Requirements</h4>
              <ul className="text-muted-foreground space-y-1 text-sm">
                <li>• Minimum 12 characters (preferably 15+)</li>
                <li>• Mix of uppercase, lowercase, numbers, symbols</li>
                <li>• Avoid dictionary words and personal information</li>
                <li>• Use passphrases for better memorability</li>
                <li>• Change default passwords immediately</li>
                <li>• Regular password rotation (quarterly)</li>
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="mb-2 font-semibold">Network Segmentation</h4>
              <ul className="text-muted-foreground space-y-1 text-sm">
                <li>• Separate guest and corporate networks</li>
                <li>• Use VLANs for network isolation</li>
                <li>• Implement firewall rules between segments</li>
                <li>• Limit guest network access to internet only</li>
                <li>• Monitor inter-VLAN traffic</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold">Additional Security Measures</h4>
              <ul className="text-muted-foreground space-y-1 text-sm">
                <li>• Enable MAC address filtering (if feasible)</li>
                <li>• Disable WPS (WiFi Protected Setup)</li>
                <li>• Use certificate-based authentication (Enterprise)</li>
                <li>• Enable wireless intrusion detection</li>
                <li>• Regular firmware updates</li>
                <li>• Monitor for rogue access points</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold">Enterprise Features</h4>
              <ul className="text-muted-foreground space-y-1 text-sm">
                <li>• 802.1X authentication with RADIUS</li>
                <li>• Certificate-based device authentication</li>
                <li>• Dynamic VLAN assignment</li>
                <li>• Captive portal for guest access</li>
                <li>• Bandwidth limiting and QoS</li>
                <li>• Centralized management and monitoring</li>
              </ul>
            </div>
          </div>
        </div>

        <Separator />

        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="mb-2 font-semibold">Security Checklist</h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[CHECKLIST.slice(0, 5), CHECKLIST.slice(5)].map((column, index) => (
              <div key={index} className="space-y-2">
                {column.map((item) => (
                  <div key={item.id} className="flex items-center space-x-2">
                    <Checkbox aria-labelledby={item.id} />
                    <span id={item.id} className="text-sm">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default SecurityGuidePanel
