export function formatRuntimeLabel(runtime: string): string {
  const [id = runtime, architecture, version] = runtime.split("/")
  const name = id
    .replace(/^org\.gnome\.Platform$/, "GNOME Platform")
    .replace(/^org\.freedesktop\.Platform$/, "Freedesktop Platform")
    .replace(/^org\.kde\.Platform$/, "KDE Platform")
    .replace(/^org\./, "")
  const shortName = name.includes(" ")
    ? name
    : name
        .split(".")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
  const suffix =
    version ?? (architecture && !architecture.includes("_") ? architecture : "")
  return [shortName, suffix].filter(Boolean).join(" ")
}

export function compareVersions(left: string, right: string): number {
  return new Intl.Collator(undefined, { numeric: true }).compare(left, right)
}
