import axios from "axios"
import { getApiBaseUrl } from "./api-url"
import qs from "qs"

axios.defaults.paramsSerializer = {
  serialize: (params) =>
    qs.stringify(params, {
      arrayFormat: "repeat",
    }),
}

axios.interceptors.request.use(
  (config) => {
    if (!config.baseURL) {
      const isAuthEndpoint = config.url?.startsWith("/auth")

      if (isAuthEndpoint) {
        config.baseURL =
          process.env.NEXT_PUBLIC_API_BASE_URI || "https://flathub.org/api/v2"
      } else {
        config.baseURL = getApiBaseUrl()
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)
