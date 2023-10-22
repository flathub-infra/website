import { Configuration, LoginApi } from "./codegen"

const apiConfig = new Configuration({
  basePath: process.env.NEXT_PUBLIC_API_BASE_URI,
})

export const loginApi = new LoginApi(apiConfig)
