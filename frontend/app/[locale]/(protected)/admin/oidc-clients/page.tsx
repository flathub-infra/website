import { Metadata } from "next"
import OidcClientsClient from "./oidc-clients-client"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "OIDC clients",
    robots: {
      index: false,
    },
  }
}

export default async function OidcClientsPage() {
  // Protection is handled by middleware and AdminLayoutClient, as session
  // authentication is not available to this server component.

  return <OidcClientsClient />
}
