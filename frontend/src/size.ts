export function calculateHumanReadableSize(size: number) {
  if (size > 1_000_000_000) {
    return (size / 1_000_000_000).toFixed(2) + " GB"
  } else if (size > 1_000_000) {
    return Math.round(size / 1_000_000) + " MB"
  } else {
    return Math.round(size / 1_000) + " KB"
  }
}
