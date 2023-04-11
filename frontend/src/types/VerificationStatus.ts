import { VerificationProvider } from "src/verificationProvider"

export type VerificationStatus =
  | VerificationStatusNone
  | VerificationStatusManual
  | VerificationStatusWebsite
  | VerificationStatusLoginProvider

export interface VerificationStatusNone {
  verified: false
  method: "none"
  detail: string
}

export interface VerificationStatusManual {
  verified: true
  timestamp: number
  method: "manual"
  detail: string
}

export interface VerificationStatusWebsite {
  verified: true
  timestamp: number
  method: "website"
  website: string
  detail: string
}

export interface VerificationStatusLoginProvider {
  verified: true
  timestamp: number
  method: "login_provider"
  login_provider: VerificationProvider
  login_name: string
  detail: string
  login_is_organization?: boolean
}
