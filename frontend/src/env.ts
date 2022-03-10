import { Category } from './types/Category'

const BASE_URI: string = process.env.NEXT_PUBLIC_API_BASE_URI

export const APPSTREAM_URL: string = `${BASE_URI}/appstream`
export const APP_DETAILS = (id: string): string => `${APPSTREAM_URL}/${id}`
export const SUMMARY_DETAILS = (id: string): string =>
  `${BASE_URI}/summary/${id}`
export const STATS_DETAILS = (id: string): string => `${BASE_URI}/stats/${id}`
export const STATS = `${BASE_URI}/stats`
export const SEARCH_APP = (query: string): string =>
  `${BASE_URI}/search/${encodeURIComponent(query)}`
export const POPULAR_URL: string = `${BASE_URI}/popular`
export const EDITORS_PICKS_GAMES_URL: string = `${BASE_URI}/picks/games`
export const EDITORS_PICKS_APPS_URL: string = `${BASE_URI}/picks/apps`
export const RECENTLY_UPDATED_URL: string = `${BASE_URI}/collection/recently-updated`
export const CATEGORY_URL = (
  category: keyof typeof Category,
  page?: number,
  per_page?: number
): string => {
  if (page && per_page) {
    return `${BASE_URI}/category/${category}?page=${page}&per_page=${per_page}`
  } else {
    return `${BASE_URI}/category/${category}`
  }
}
export const DEVELOPER_URL = (developer: string): string =>
  `${BASE_URI}/developer/${encodeURIComponent(developer)}`
export const FEED_RECENTLY_UPDATED_URL: string = `${BASE_URI}/feed/recently-updated`
export const FEED_NEW_URL: string = `${BASE_URI}/feed/new`

export const APPS_IN_PREVIEW_COUNT: number = 6

export const IMAGE_BASE_URL: string = `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/img/`

export const LOGIN_PROVIDERS_URL: string = `${BASE_URI}/auth/login`
export const USER_INFO_URL: string = `${BASE_URI}/auth/userinfo`
export const LOGOUT_URL: string = `${BASE_URI}/auth/logout`
export const USER_DELETION_URL: string = `${BASE_URI}/auth/deleteuser`

export const WALLET_BASE_URL: string = `${BASE_URI}/wallet`
export const WALLET_INFO_URL: string = `${WALLET_BASE_URL}/walletinfo`
export const TRANSACTIONS_URL: string = `${WALLET_BASE_URL}/transactions`
export const STRIPE_DATA_URL: string = `${WALLET_BASE_URL}/stripedata`
export const TRANSACTION_INFO_URL= (transaction: string) => {
  return `${TRANSACTIONS_URL}/${transaction}`
}
export const TRANSACTION_STRIPE_INFO_URL = (transaction: string) => {
  return `${TRANSACTION_INFO_URL(transaction)}/stripe`
}
export const TRANSACTION_SAVE_CARD_URL = (transaction: string) => {
  return `${TRANSACTION_INFO_URL(transaction)}/savecard`
}
export const TRANSACTION_SET_CARD_URL = (transaction: string) => {
  return `${TRANSACTION_INFO_URL(transaction)}/setcard`
}

export const IS_PRODUCTION: boolean =
  process.env.NEXT_PUBLIC_IS_PRODUCTION === 'true'
