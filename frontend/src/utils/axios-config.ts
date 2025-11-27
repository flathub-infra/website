import axios, { AxiosError, InternalAxiosRequestConfig } from "axios"
import { getApiBaseUrl } from "./api-url"
import qs from "qs"

const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableErrors: ["ECONNABORTED", "ETIMEDOUT", "ENOTFOUND", "ENETUNREACH"],
}

axios.defaults.paramsSerializer = {
  serialize: (params) =>
    qs.stringify(params, {
      arrayFormat: "repeat",
    }),
}

axios.interceptors.request.use(
  (config) => {
    config.baseURL = getApiBaseUrl()
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

axios.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig & {
      _retryCount?: number
    }

    if (!config) {
      return Promise.reject(error)
    }

    config._retryCount = config._retryCount || 0

    const isRetryableStatus =
      error.response?.status &&
      RETRY_CONFIG.retryableStatuses.includes(error.response.status)
    const isRetryableError =
      error.code && RETRY_CONFIG.retryableErrors.includes(error.code)

    if (!isRetryableStatus && !isRetryableError) {
      return Promise.reject(error)
    }

    if (config._retryCount >= RETRY_CONFIG.maxRetries) {
      console.error(
        `Max retries (${RETRY_CONFIG.maxRetries}) exceeded for ${config.url}`,
        error.message,
      )
      return Promise.reject(error)
    }

    config._retryCount += 1

    const baseDelay =
      RETRY_CONFIG.baseDelay *
      Math.pow(RETRY_CONFIG.backoffMultiplier, config._retryCount - 1)
    const jitter = Math.random() * 0.3 * baseDelay
    const delay = Math.min(baseDelay + jitter, RETRY_CONFIG.maxDelay)

    console.warn(
      `Retrying ${config.url} (attempt ${config._retryCount}/${RETRY_CONFIG.maxRetries}) ` +
        `after ${Math.round(delay)}ms. Error: ${error.message}`,
    )

    await new Promise((resolve) => setTimeout(resolve, delay))

    return axios(config)
  },
)
