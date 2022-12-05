import { VerificationProvider } from "src/verificationProvider"

export interface VerificationAvailableMethods {
  methods: VerificationAvailableMethod[]
  detail: string
}

export type VerificationAvailableMethod =
  | VerificationMethodLoginProvider
  | VerificationMethodWebsite

export interface VerificationMethodLoginProvider {
  method: "login_provider"
  login_provider: VerificationProvider
  login_name: string
}

export interface VerificationMethodWebsite {
  method: "website"
  website: string
  website_token?: string
}
