import { UserState, UserStateAction } from "../types/Login"

export function contextReducer(
  state: UserState,
  action: UserStateAction,
): UserState {
  switch (action.type) {
    case "loading":
      // Reducers should not mutate the current state object
      return {
        ...state,
        loading: true,
      }
    case "interrupt":
      return {
        ...state,
        loading: false,
      }
    case "login":
      return {
        loading: false,
        info: action.info,
      }
    case "logout":
      return {
        loading: false,
      }
    case "update-dev-flatpaks":
      return {
        ...state,
        info: {
          ...state.info,
          "dev-flatpaks": action.devFlatpaks,
        },
      }
    default:
      return state
  }
}
