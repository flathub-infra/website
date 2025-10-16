import { GetUserinfoAuthUserinfoGet200 } from "src/codegen"

export interface LoginRedirect {
  redirect: string
}

// State houses user info, along with whether it's currently mid-request
export interface UserState {
  loading: boolean
  info?: GetUserinfoAuthUserinfoGet200
}

// For calls to user state reducer's dispatch method
export interface UserStateAction {
  type: "loading" | "interrupt" | "login" | "logout" | "update-dev-flatpaks"
  info?: GetUserinfoAuthUserinfoGet200
  devFlatpaks?: string[]
}
