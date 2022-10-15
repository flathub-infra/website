export type VerificationStatus =
  | VerificationStatusNone
  | VerificationStatusManual
  | VerificationStatusWebsite
  | VerificationStatusLoginProvider

export interface VerificationStatusNone {
  verified: boolean
  method: "none"
  detail: string
}

export interface VerificationStatusManual {
  verified: boolean
  method: "manual"
  detail: string
}

export interface VerificationStatusWebsite {
  verified: boolean
  method: "website"
  website: string
  detail: string
}

export interface VerificationStatusLoginProvider {
  verified: boolean
  method: "login_provider"
  login_provider: string
  login_name: string
  detail: string
}
