type Appstream = {
  id: string,
  name: string,
  summary: string,
  description: string,
  categories: string[],
  keywords: string[],
  kudos: string[],
  provides: string[],
  project_license: string,
  project_group: string,
  developer_name: string,
  releases: Release[],
  screenshots: Screenshot[],
  urls: Urls,
}

type Urls = {
  bugtracker: string,
  donation: string,
  homepage: string,
  translate: string,
}

type Screenshot = {
  small: string,
  medium: string,
  default: string,
  large: string,
}

type Release = {
  timestamp: number,
  version: string,
  description: string,
}

export default Appstream
