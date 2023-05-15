export type ModerationRequestType = "appdata"

export interface ModerationAppItem {
  appid: string
  is_new_submission: boolean
  updated_at: string
  request_types: ModerationRequestType[]
}

export interface ModerationApps {
  apps: ModerationAppItem[]
  apps_count: number
}

export interface ModerationRequestBase {
  id: number
  appid: string
  created_at: number

  build_id: number
  job_id: number
  is_outdated: boolean

  is_new_submission: boolean

  handled_by?: string
  handled_at?: number
  is_approved?: boolean
  comment?: string
}

export interface ModerationAppdataRequest extends ModerationRequestBase {
  request_type: "appdata"
  request_data: {
    keys: { [key: string]: string }
    current_values: { [key: string]: string }
  }
}

export type ModerationRequest = ModerationAppdataRequest

export interface ModerationApp {
  requests: ModerationRequest[]
  requests_count: number
}
