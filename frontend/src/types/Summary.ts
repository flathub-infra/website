interface SessionBus {
  talk: string[]
  own: string[]
}

interface Permissions {
  shared: string[]
  sockets: string[]
  devices: string[]
  filesystems: string[]
  sessionBus: SessionBus
}

interface ComSpotifyClientDebug {
  directory: string
  autodelete: string
  noAutodownload: string
}

interface Extensions {
  [key: string]: ComSpotifyClientDebug
}

interface ExtraData {
  name: string
  checksum: string
  size: string
  uri: string
}

interface Metadata {
  name: string
  runtime: string
  sdk: string
  tags: string[]
  command: string
  permissions: Permissions
  extensions: Extensions
  builtExtensions: string[]
  extraData: ExtraData
}

export interface Summary {
  arches: string[]
  timestamp: number
  download_size: number
  installed_size: number
  metadata: Metadata
}
