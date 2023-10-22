import {
  AppApi,
  AuthApi,
  CompatApi,
  Configuration,
  EmailApi,
  FeedApi,
  HealthcheckApi,
  InviteApi,
  ModerationApi,
  PurchaseApi,
  VerificationApi,
  WalletApi,
} from "./codegen"

const apiConfig = new Configuration({
  basePath: process.env.NEXT_PUBLIC_API_BASE_URI,
})

export const emailApi = new EmailApi(apiConfig)

export const authApi = new AuthApi(apiConfig)

export const moderationApi = new ModerationApi(apiConfig)

export const walletApi = new WalletApi(apiConfig)

export const verificationApi = new VerificationApi(apiConfig)

export const purchaseApi = new PurchaseApi(apiConfig)

export const inviteApi = new InviteApi(apiConfig)

export const compatApi = new CompatApi(apiConfig)

export const qualityModerationApi = new ModerationApi(apiConfig)

export const appApi = new AppApi(apiConfig)

export const feedApi = new FeedApi(apiConfig)

export const healthcheckApi = new HealthcheckApi(apiConfig)
