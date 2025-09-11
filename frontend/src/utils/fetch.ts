/**
 * Robust fetch utility with timeout, retries, and error handling
 */

interface FetchOptions extends RequestInit {
  timeout?: number
  retries?: number
  retryDelay?: number
  validateStatus?: (status: number) => boolean
}

interface RetryableError extends Error {
  retryable: boolean
}

const DEFAULT_TIMEOUT = 10000 // 10 seconds
const DEFAULT_RETRIES = 3
const DEFAULT_RETRY_DELAY = 1000 // 1 second

/**
 * Creates a retryable error
 */
function createRetryableError(
  message: string,
  retryable = true,
): RetryableError {
  const error = new Error(message) as RetryableError
  error.retryable = retryable
  return error
}

/**
 * Determines if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes("fetch")) {
    // Network errors are retryable
    return true
  }

  if (error && typeof error === "object" && "retryable" in error) {
    return (error as RetryableError).retryable
  }

  return false
}

/**
 * Determines if a status code represents a retryable error
 */
function isRetryableStatus(status: number): boolean {
  // Retry on server errors and rate limiting
  return status >= 500 || status === 429
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Robust fetch with timeout, retries, and proper error handling
 */
export async function robustFetch(
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  const {
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    validateStatus = (status) => status >= 200 && status < 300,
    ...fetchOptions
  } = options

  // Add default headers for security
  const defaultHeaders: HeadersInit = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...fetchOptions.headers,
  }

  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        ...fetchOptions,
        headers: defaultHeaders,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Check if the status is acceptable
      if (!validateStatus(response.status)) {
        if (isRetryableStatus(response.status) && attempt < retries) {
          lastError = createRetryableError(
            `HTTP ${response.status}: ${response.statusText}`,
          )
          await sleep(retryDelay * Math.pow(2, attempt)) // Exponential backoff
          continue
        }

        // Non-retryable status error
        throw createRetryableError(
          `HTTP ${response.status}: ${response.statusText}`,
          false,
        )
      }

      return response
    } catch (error) {
      lastError = error

      // Handle abort (timeout)
      if (error instanceof Error && error.name === "AbortError") {
        if (attempt < retries) {
          await sleep(retryDelay * Math.pow(2, attempt))
          continue
        }
        throw createRetryableError("Request timeout", true)
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes("fetch")) {
        if (attempt < retries) {
          await sleep(retryDelay * Math.pow(2, attempt))
          continue
        }
        throw createRetryableError("Network error", true)
      }

      // Handle other retryable errors
      if (isRetryableError(error) && attempt < retries) {
        await sleep(retryDelay * Math.pow(2, attempt))
        continue
      }

      // Non-retryable error or max retries reached
      throw error
    }
  }

  // This should never be reached, but just in case
  throw lastError || new Error("Max retries exceeded")
}

/**
 * Robust fetch that returns JSON with proper error handling
 */
export async function robustFetchJson<T = any>(
  url: string,
  options: FetchOptions = {},
): Promise<T> {
  const response = await robustFetch(url, options)

  try {
    return await response.json()
  } catch (error) {
    throw createRetryableError("Invalid JSON response", false)
  }
}

/**
 * Robust fetch with predefined options for common use cases
 */
export const fetchWithDefaults = {
  /**
   * GET request with default options
   */
  get: (url: string, options: Omit<FetchOptions, "method"> = {}) =>
    robustFetch(url, { ...options, method: "GET" }),

  /**
   * POST request with default options
   */
  post: (
    url: string,
    data?: any,
    options: Omit<FetchOptions, "method" | "body"> = {},
  ) =>
    robustFetch(url, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  /**
   * GET request that returns JSON
   */
  getJson: <T = any>(url: string, options: Omit<FetchOptions, "method"> = {}) =>
    robustFetchJson<T>(url, { ...options, method: "GET" }),

  /**
   * POST request that returns JSON
   */
  postJson: <T = any>(
    url: string,
    data?: any,
    options: Omit<FetchOptions, "method" | "body"> = {},
  ) =>
    robustFetchJson<T>(url, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),
}
