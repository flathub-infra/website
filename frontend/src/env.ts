import Category from "./types/Category"

const BASE_URI: string = 'https://flathub-backend.openshift.gnome.org/master'

export const APPSTREAM_URL: string = `${BASE_URI}/appstream`
export const APP_DETAILS = (id: string): string => `${APPSTREAM_URL}/${id}`
export const SUMMARY_DETAILS = (id: string): string => `${BASE_URI}/summary/${id}`
export const SEARCH_APP = (query: string): string => `${BASE_URI}/search/${query}`
export const POPULAR_URL: string = `${BASE_URI}/popular`
export const EDITORS_PICKS_GAMES_URL: string = `${BASE_URI}/picks/games`
export const EDITORS_PICKS_APPS_URL: string = `${BASE_URI}/picks/apps`
export const RECENTLY_UPDATED_URL: string = `${BASE_URI}/collection/recently-updated`
export const CATEGORY_URL = (category: keyof typeof Category): string => `${BASE_URI}/category/${category}`
