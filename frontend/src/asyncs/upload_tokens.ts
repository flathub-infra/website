import {
  UPLOAD_TOKENS_URL,
  UPLOAD_TOKEN_CREATE_URL,
  UPLOAD_TOKEN_REVOKE_URL,
} from "src/env"

export type Repo = "stable" | "beta"

export interface TokenResponse {
  id: number
  comment: string

  app_id: string
  scopes: string[]
  repos: Repo[]

  issued_at: number
  issued_to?: string
  expires_at: number
  revoked: boolean
}

export interface TokensResponse {
  tokens: TokenResponse[]
  is_direct_upload_app: boolean
}

export interface NewTokenResponse {
  token: string
  details: TokenResponse
}

export async function getUploadTokens(
  appId: string,
  includeExpired: boolean,
): Promise<TokensResponse> {
  const response = await fetch(UPLOAD_TOKENS_URL(appId, includeExpired), {
    credentials: "include",
  })
  return await response.json()
}

export async function createUploadToken(
  app_id: string,
  comment: string,
  scopes: string[],
  repos: Repo[],
): Promise<NewTokenResponse> {
  const response = await fetch(UPLOAD_TOKEN_CREATE_URL(app_id), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ comment, scopes, repos }),
  })
  if (!response.ok) {
    throw "network-error-try-again"
  }
  return await response.json()
}

export async function revokeUploadToken(tokenId: number): Promise<void> {
  await fetch(UPLOAD_TOKEN_REVOKE_URL(tokenId), {
    method: "POST",
    credentials: "include",
  })
}
