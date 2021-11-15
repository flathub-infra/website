export interface Appstream {
  description: string
  screenshots: Screenshot[]
  releases: Release[]
  content_rating: ContentRating
  urls: Urls
  icon: string
  id: string
  name: string
  summary: string
  developer_name: string
  categories: string[]
  kudos: string[]
  mimetypes: string[]
  project_license: string
  provides: string[]
  launchable: Launchable
  bundle: Bundle
}

interface ContentRating {
  type: string
  'violence-cartoon': ContentRatingLevel
  'violence-fantasy': ContentRatingLevel
  'violence-realistic': ContentRatingLevel
  'violence-bloodshed': ContentRatingLevel
  'violence-sexual': ContentRatingLevel
  'violence-desecration': ContentRatingLevel
  'violence-slavery': ContentRatingLevel
  'violence-worship': ContentRatingLevel
  'drugs-alcohol': ContentRatingLevel
  'drugs-narcotics': ContentRatingLevel
  'drugs-tobacco': ContentRatingLevel
  'sex-nudity': ContentRatingLevel
  'sex-themes': ContentRatingLevel
  'sex-homosexuality': ContentRatingLevel
  'sex-prostitution': ContentRatingLevel
  'sex-adultery': ContentRatingLevel
  'sex-appearance': ContentRatingLevel
  'language-profanity': ContentRatingLevel
  'language-humor': ContentRatingLevel
  'language-discrimination': ContentRatingLevel
  'social-chat': ContentRatingLevel
  'social-info': ContentRatingLevel
  'social-audio': ContentRatingLevel
  'social-location': ContentRatingLevel
  'social-contacts': ContentRatingLevel
  'money-purchasing': ContentRatingLevel
  'money-gambling': ContentRatingLevel
}

type ContentRatingLevel = 'none' | 'mild' | 'moderate' | 'intense'

export interface Urls {
  bugtracker: string
  donation: string
  homepage: string
  translate: string
  help: string
  faq: string
  contact: string
}

export interface Screenshot {
  '624x351'?: string
  '1248x702'?: string
  '112x63'?: string
  '224x126'?: string
  '752x423'?: string
  '1504x846'?: string
}

export interface Release {
  description?: string
  timestamp: number
  version: string
}

export interface Launchable {
  value: string
  type: string
}

export interface Bundle {
  value: string
  type: string
  runtime: string
  sdk: string
}
