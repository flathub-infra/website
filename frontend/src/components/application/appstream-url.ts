export function appstreamUrl(value?: string | null, allowMail = false) {
  if (!value) {
    return undefined
  }
  try {
    const url = new URL(value)
    if (
      url.protocol === "https:" ||
      url.protocol === "http:" ||
      (allowMail && url.protocol === "mailto:")
    ) {
      return url.href
    }
  } catch {
    return undefined
  }
  return undefined
}

export function packagingLink(appId: string, manifest?: string | null) {
  const url = appstreamUrl(manifest)
  return {
    href: url ?? `https://github.com/flathub/${appId}`,
    isManifest: !!url,
  }
}
