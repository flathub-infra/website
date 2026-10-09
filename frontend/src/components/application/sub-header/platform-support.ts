type AppstreamCondition = Record<string, string>
type Relation = "required" | "recommended" | "supported" | "unknown"
export type DisplaySupport =
  "required" | "supported" | "unsupported" | "unknown"

const includesCondition = (
  conditions: AppstreamCondition[] | null | undefined,
  type: string,
  value?: string,
) =>
  conditions?.some(
    (condition) =>
      condition.type === type &&
      (value === undefined || condition.value === value),
  ) ?? false

export const getControlRelation = (
  value: string,
  requires: AppstreamCondition[] | null | undefined,
  recommends: AppstreamCondition[] | null | undefined,
  supports: AppstreamCondition[] | null | undefined,
): Relation => {
  if (includesCondition(requires, "control", value)) return "required"
  if (includesCondition(recommends, "control", value)) return "recommended"
  if (includesCondition(supports, "control", value)) return "supported"
  return "unknown"
}

export const isAdaptive = (
  requires: AppstreamCondition[] | null | undefined,
  recommends: AppstreamCondition[] | null | undefined,
  supports: AppstreamCondition[] | null | undefined,
) =>
  ["touch", "keyboard", "pointing"].every((control) => {
    const relation = getControlRelation(control, requires, recommends, supports)
    return relation === "recommended" || relation === "supported"
  })

const displayRanges: Record<string, [number, number]> = {
  xsmall: [0, 360],
  small: [360, 768],
  medium: [768, 1024],
  large: [1024, 3840],
  xlarge: [3840, Number.MAX_SAFE_INTEGER],
}

const displayRange = (value: string): [number, number] | undefined => {
  const numericValue = Number(value)
  if (Number.isFinite(numericValue) && value.trim() !== "") {
    return [numericValue, numericValue]
  }
  return displayRanges[value.toLowerCase()]
}

const displayComparisonMatches = (
  category: [number, number],
  compare: string,
  condition: [number, number],
) => {
  switch (compare) {
    case "eq":
      return category[0] === condition[0] && category[1] === condition[1]
    case "ne":
      return category[0] !== condition[0] || category[1] !== condition[1]
    case "gt":
      return category[0] > condition[1]
    case "ge":
      return category[0] >= condition[0]
    case "lt":
      return category[1] < condition[0]
    case "le":
      return category[1] <= condition[1]
    default:
      return false
  }
}

export const getDisplaySupport = (
  category: "mobile" | "desktop",
  requires: AppstreamCondition[] | null | undefined,
  recommends: AppstreamCondition[] | null | undefined,
  supports: AppstreamCondition[] | null | undefined,
): DisplaySupport => {
  const relations: [Relation, AppstreamCondition[] | null | undefined][] = [
    ["required", requires],
    ["recommended", recommends],
    ["supported", supports],
  ]
  const displayRelations = relations.flatMap(([relation, conditions]) =>
    (conditions ?? [])
      .filter((condition) => condition.type === "display_length")
      .map((condition) => ({ relation, condition })),
  )

  if (displayRelations.length === 0) return "unknown"

  const categoryRange: [number, number] =
    category === "mobile" ? [360, 768] : [1024, 3840]
  const matches = displayRelations.filter(({ condition }) => {
    const range = displayRange(condition.value ?? "")
    return (
      range !== undefined &&
      displayComparisonMatches(categoryRange, condition.compare ?? "ge", range)
    )
  })

  if (matches.some(({ relation }) => relation === "required")) return "required"
  if (matches.length > 0) return "supported"
  return "unsupported"
}

export const isAdaptiveForDeclaredHardware = (
  requires: AppstreamCondition[] | null | undefined,
  recommends: AppstreamCondition[] | null | undefined,
  supports: AppstreamCondition[] | null | undefined,
) =>
  isAdaptive(requires, recommends, supports) &&
  (["mobile", "desktop"] as const).every((category) => {
    const displaySupport = getDisplaySupport(
      category,
      requires,
      recommends,
      supports,
    )
    return displaySupport === "required" || displaySupport === "supported"
  })

export const hasRequiredControls = (
  requires: AppstreamCondition[] | null | undefined,
) => requires?.some((condition) => condition.type === "control") ?? false
