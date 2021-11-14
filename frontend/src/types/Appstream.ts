export interface Appstream {
  description: string
  screenshots: Screenshot[]
  releases: Release[]
  content_rating: string
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
  launchable: {
    value: string
    type: string
  }
  bundle: {
    value: string
    type: string
    runtime: string
    sdk: string
  }
}

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
