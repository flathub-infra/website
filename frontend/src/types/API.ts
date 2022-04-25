export interface APIResponseOk {
  status: "ok"
}

export interface APIResponseError {
  status: "error"
  error: string
}
