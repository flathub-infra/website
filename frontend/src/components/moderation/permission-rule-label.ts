import type { PermissionRuleInput } from "src/codegen"

export const ruleLabel = (
  rule: Pick<
    PermissionRuleInput,
    "match_type" | "key" | "before" | "value" | "removed" | "added" | "required"
  >,
) => {
  if (rule.match_type === "grouped-delta") {
    const condition = rule.required?.length
      ? `; keep [${rule.required.join(", ")}]`
      : ""
    return `${rule.key}: remove [${(rule.removed ?? []).join(", ")}] → add [${(rule.added ?? []).join(", ")}] (atomic group)${condition}`
  }
  return rule.match_type === "transition"
    ? `${rule.key}: ${rule.before ?? "Absent"} → ${rule.value ?? "Absent"}`
    : `${rule.key}=${rule.value}`
}
