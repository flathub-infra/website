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
      config.baseURL = getApiBaseUrl()
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)
