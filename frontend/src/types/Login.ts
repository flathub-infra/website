export interface LoginProvider {
  method: string,
  button: string,
  text: string,
}

export interface LoginRedirect {
  redirect: string
}

// Corresponds to body returned by `/auth/userinfo`
export interface UserInfo {
  displayname: string,
  github_login: string,
  github_avatar: string,
  'dev-flatpaks': string[],
}

// State houses user info, along with whether it's currently mid-request
export interface UserState {
  loading: boolean,
  info?: UserInfo
}

// For calls to user state reducer's dispatch method
export interface UserStateAction {
  type: string,
  info?: UserInfo
}
