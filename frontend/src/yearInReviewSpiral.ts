export function yearInReviewSpiral(newAppsCount: number) {
  const turn = Math.PI * (3 - Math.sqrt(5))
  return Array.from({ length: newAppsCount }, (_, i) => {
    const distance = 94 * Math.sqrt((i + 0.5) / newAppsCount)
    return {
      x: Number((distance * Math.cos(i * turn)).toFixed(3)),
      y: Number((distance * Math.sin(i * turn)).toFixed(3)),
    }
  })
}
