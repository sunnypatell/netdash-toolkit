"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Info, Mail, MapPin, Phone, User } from "lucide-react"
import { flattenEntities, redactedFieldNames, type RDAPDomainResponse } from "@/lib/rdap"

export default function ContactsPanel({ domain }: { domain: RDAPDomainResponse }) {
  // rfc 9083 5.1: entities nest, so a flat pass dropped the abuse contact under the registrar
  const contacts = flattenEntities(domain.entities)
  const redacted = redactedFieldNames(domain)

  return (
    <div className="grid gap-4">
      {redacted.length > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            This registry declared {redacted.length} redacted field
            {redacted.length === 1 ? "" : "s"} (RFC 9537): {redacted.join(", ")}. Those values exist
            and are withheld from public RDAP - they are not missing from the registration.
          </AlertDescription>
        </Alert>
      )}

      {contacts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No contact entities in the response. Most gTLD registries publish none at all since
              GDPR, so this usually means &quot;not published&quot; rather than &quot;not
              recorded&quot;.
            </p>
          </CardContent>
        </Card>
      ) : (
        contacts.map((contact, index) => (
          <Card key={`${contact.handle ?? "entity"}-${index}`}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <User className="h-4 w-4" aria-hidden="true" />
                {contact.name || contact.organization || contact.handle || "Contact"}
                {contact.roles.map((role, i) => (
                  <Badge key={i} variant="outline" className="text-xs capitalize">
                    {role.replace(/_/g, " ")}
                  </Badge>
                ))}
                {contact.depth > 0 && (
                  <Badge variant="secondary" className="text-xs font-normal">
                    nested contact
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                {contact.organization && (
                  <div className="flex items-center gap-2">
                    <Building2 className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                    <span>{contact.organization}</span>
                  </div>
                )}
                {contact.emails.map((email, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Mail className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                    <a href={`mailto:${email}`} className="text-primary break-all hover:underline">
                      {email}
                    </a>
                  </div>
                ))}
                {contact.phones.map((phone, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Phone className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                    <span>{phone}</span>
                  </div>
                ))}
                {contact.address && (
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <MapPin className="text-muted-foreground mt-0.5 h-4 w-4" aria-hidden="true" />
                    <span>{contact.address}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
