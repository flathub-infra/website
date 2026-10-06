export type BadgeSize = "default" | "padded"

export const BADGE_SIZES = {
  default: {
    canvasWidth: 240,
    canvasHeight: 80,
    badgeWidth: 240,
    badgeHeight: 80,
    iconWidth: 55.885,
    iconHeight: 55,
    gap: 16,
    padding: 14,
    borderRadius: 16,
    labelFontSize: 16,
    labelLineHeight: 18,
    nameFontSize: 36,
    nameLineHeight: 46,
    namePaddingTop: 6,
  },
  padded: {
    // Match the transparent outer padding in store badge assets. The visible
    // 269x80 badge sits inside an image whose natural ratio is about 2.58:1.
    canvasWidth: 308,
    canvasHeight: 119,
    badgeWidth: 269,
    badgeHeight: 80,
    iconWidth: 55.885,
    iconHeight: 55,
    gap: 16,
    padding: 18,
    borderRadius: 10,
    labelFontSize: 16,
    labelLineHeight: 18,
    nameFontSize: 36,
    nameLineHeight: 46,
    namePaddingTop: 6,
  },
} as const satisfies Record<BadgeSize, Record<string, number>>

export function parseBadgeSize(value: string | null): BadgeSize | null {
  if (value === null || value === "default") return "default"
  if (value === "padded") return "padded"
  return null
}
