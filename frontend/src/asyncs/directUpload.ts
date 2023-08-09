import { Dispatch } from "react"
import {
  ACCEPT_INVITE_URL,
  GET_DEVELOPERS_URL,
  INVITE_DEVELOPER_URL,
  REMOVE_DEVELOPER_URL,
  INVITE_STATUS_URL,
  DECLINE_INVITE_URL,
  LEAVE_TEAM_URL,
  REVOKE_INVITE_URL,
} from "src/env"
import { UserStateAction } from "src/types/Login"
import { getUserData } from "./login"

export interface InviteStatus {
  is_pending: boolean
  is_direct_upload_app: boolean
}

export async function getInviteStatus(appId: string): Promise<InviteStatus> {
  let res: Response
  let json: any
  try {
    res = await fetch(INVITE_STATUS_URL(appId), {
      credentials: "include",
    })

    json = await res.json()
  } catch {
    throw "network-error-try-again"
  }

  if (!res.ok) {
    throw (json.detail as string) || "network-error-try-again"
  }

  return json
}

export interface Developer {
  id: number
  name: string
  is_self: boolean
  is_primary: boolean
}

interface DevelopersResponse {
  developers: Developer[]
  invites: Developer[]
}

export async function getDevelopers(
  appId: string,
): Promise<DevelopersResponse> {
  let res: Response
  let json: any
  try {
    res = await fetch(GET_DEVELOPERS_URL(appId), {
      credentials: "include",
    })

    json = await res.json()
  } catch {
    throw "network-error-try-again"
  }

  if (!res.ok) {
    throw (json.detail as string) || "network-error-try-again"
  }

  return json
}

export async function removeDeveloper(appId: string, developerId: number) {
  let res: Response
  let error: string
  try {
    res = await fetch(REMOVE_DEVELOPER_URL(appId, developerId), {
      method: "POST",
      credentials: "include",
    })

    if (!res.ok) {
      error = (await res.json()).detail || "network-error-try-again"
    }
  } catch {
    throw "network-error-try-again"
  }

  if (error) {
    throw error
  }
}

export async function inviteDeveloper(appId: string, inviteCode: string) {
  let res: Response
  let error: string
  try {
    res = await fetch(INVITE_DEVELOPER_URL(appId, inviteCode), {
      method: "POST",
      credentials: "include",
    })

    if (!res.ok) {
      error = (await res.json()).detail || "network-error-try-again"
    }
  } catch {
    throw "network-error-try-again"
  }

  if (error) {
    throw error
  }
}

export async function acceptInvite(
  appId: string,
  dispatch: Dispatch<UserStateAction>,
) {
  let res: Response
  let error: string
  try {
    res = await fetch(ACCEPT_INVITE_URL(appId), {
      method: "POST",
      credentials: "include",
    })

    if (!res.ok) {
      error = (await res.json()).detail || "network-error-try-again"
    }
  } catch {
    throw "network-error-try-again"
  }

  if (error) {
    throw error
  }

  await getUserData(dispatch)
}

export async function declineInvite(
  appId: string,
  dispatch: Dispatch<UserStateAction>,
) {
  let res: Response
  let error: string
  try {
    res = await fetch(DECLINE_INVITE_URL(appId), {
      method: "POST",
      credentials: "include",
    })

    if (!res.ok) {
      error = (await res.json()).detail || "network-error-try-again"
    }
  } catch {
    throw "network-error-try-again"
  }

  if (error) {
    throw error
  }

  await getUserData(dispatch)
}

export async function revokeInvite(appId: string, developerId: number) {
  let res: Response
  let error: string
  try {
    res = await fetch(REVOKE_INVITE_URL(appId, developerId), {
      method: "POST",
      credentials: "include",
    })

    if (!res.ok) {
      error = (await res.json()).detail || "network-error-try-again"
    }
  } catch {
    throw "network-error-try-again"
  }

  if (error) {
    throw error
  }
}

export async function leaveTeam(
  appId: string,
  dispatch: Dispatch<UserStateAction>,
) {
  let res: Response
  let error: string
  try {
    res = await fetch(LEAVE_TEAM_URL(appId), {
      method: "POST",
      credentials: "include",
    })

    if (!res.ok) {
      error = (await res.json()).detail || "network-error-try-again"
    }
  } catch {
    throw "network-error-try-again"
  }

  if (error) {
    throw error
  }

  await getUserData(dispatch)
}
