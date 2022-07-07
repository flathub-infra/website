import { APIResponseOk } from "./API"

export interface LoginProvider {
  method: string
  name: string
}

export interface LoginRedirect {
  redirect: string
}

// Corresponds to body returned by `/auth/userinfo`
export interface AuthInfo {
  avatar?: string
  login?: string
}
export interface UserInfo {
  displayname: string
  "dev-flatpaks": string[]
  "owned-flatpaks": string[]
  auths: Record<string, AuthInfo>
}

// State houses user info, along with whether it's currently mid-request
export interface UserState {
  loading: boolean
  info?: UserInfo
}

// For calls to user state reducer's dispatch method
export interface UserStateAction {
  type: string
  info?: UserInfo
}

// GET /auth/deleteuser
export interface UserDeletionToken extends APIResponseOk {
  token: string
}
