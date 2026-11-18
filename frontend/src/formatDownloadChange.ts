export function formatDownloadChange(
  locale: string,
  delta: number,
  percentage: number,
) {
  if (!Number.isFinite(delta) || !Number.isFinite(percentage)) {
    return null
  }
  const useCount = delta !== 0 && percentage === 0
  return new Intl.NumberFormat(locale, {
    style: useCount ? "decimal" : "percent",
    signDisplay: "exceptZero",
    maximumFractionDigits: 1,
  }).format(useCount ? delta : (Math.sign(delta) * Math.abs(percentage)) / 100)
}
