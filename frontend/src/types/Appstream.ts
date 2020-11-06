interface Appstream {
  categories: string[]
  description: string
  developer_name: string
  id: string
  keywords: string[]
  kudos: string[]
  name: string
  project_group: string
  project_license: string
  provides: string[]
  releases: Release[]
  screenshots: Screenshot[]
  summary: string
  urls: Urls
}

interface Urls {
  bugtracker: string
  donation: string
  homepage: string
  translate: string
}

interface Screenshot {
  default: string
  large: string
  medium: string
  small: string
}

interface Release {
  description: string
  timestamp: number
  version: string
}

export default Appstream
