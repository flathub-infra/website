import { FunctionComponent, ReactNode } from "react"
import { useTranslations } from "next-intl"
import { cva } from "class-variance-authority"
import diff from "fast-diff"
import { cn } from "@/lib/utils"

const diffValueVariants = cva("", {
  variants: {
    kind: {
      removed:
        "bg-[oklch(97%_0.012_25)] text-[oklch(43%_0.15_25)] dark:bg-[oklch(28%_0.028_25)] dark:text-[oklch(82%_0.1_25)]",
      added:
        "bg-[oklch(97%_0.018_155)] text-[oklch(38%_0.1_155)] dark:bg-[oklch(28%_0.028_155)] dark:text-[oklch(83%_0.1_155)]",
    },
  },
})

const diffValueClassName =
  "border-s px-4 py-4 font-mono text-xs leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere] before:mb-3 before:block before:font-sans before:text-xs before:font-semibold before:content-[attr(data-label)] sm:before:hidden"

type Difference = { path: string[]; before: unknown; after: unknown }

interface Props {
  differences?: { [key: string]: unknown }[] | null
  source?: string | null
  snapshot?: object | null
}

const show = (value: unknown) =>
  value === null || value === undefined
    ? "—"
    : typeof value === "string"
      ? value
      : JSON.stringify(value, null, 1)

const busPolicyGroups = ["Session Bus Policy", "System Bus Policy"]

const groupBusPolicies = (rows: Difference[]): Difference[] => {
  const result: Difference[] = []
  const policies = new Map<string, Difference>()
  for (const row of rows) {
    const [arch, group, name] = row.path
    if (!busPolicyGroups.includes(group)) {
      result.push(row)
      continue
    }
    for (const side of ["before", "after"] as const) {
      const value = row[side] as Record<string, string> | string | null
      const entries =
        name === undefined
          ? Object.entries(value ?? {})
          : value === null
            ? []
            : [[name, value as string]]
      for (const [busName, policy] of entries) {
        const key = `${arch}\0${group}\0${policy}`
        let entry = policies.get(key)
        if (!entry) {
          entry = { path: [arch, group, policy], before: null, after: null }
          policies.set(key, entry)
          result.push(entry)
        }
        entry[side] = [...((entry[side] as string[]) ?? []), busName].sort()
      }
    }
  }
  return result
}

type LineChange = {
  before: string | null
  after: string | null
  changed: boolean
}

const alignLines = (before: string[], after: string[]): LineChange[] => {
  // Keep the LCS matrix bounded for unusually large permission values.
  if (before.length * after.length > 100_000) {
    const count = Math.max(before.length, after.length)
    return Array.from({ length: count }, (_, index) => ({
      before: before[index] ?? null,
      after: after[index] ?? null,
      changed: before[index] !== after[index],
    }))
  }

  const lcs = Array.from({ length: before.length + 1 }, () =>
    Array<number>(after.length + 1).fill(0),
  )

  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      lcs[i][j] =
        before[i] === after[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const operations: { kind: "equal" | "delete" | "insert"; line: string }[] = []
  let i = 0
  let j = 0
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      operations.push({ kind: "equal", line: before[i] })
      i++
      j++
    } else if (
      i < before.length &&
      (j === after.length || lcs[i + 1][j] >= lcs[i][j + 1])
    ) {
      operations.push({ kind: "delete", line: before[i++] })
    } else {
      operations.push({ kind: "insert", line: after[j++] })
    }
  }

  const aligned: LineChange[] = []
  let deleted: string[] = []
  let inserted: string[] = []
  const flushChanges = () => {
    const count = Math.max(deleted.length, inserted.length)
    for (let index = 0; index < count; index++) {
      aligned.push({
        before: deleted[index] ?? null,
        after: inserted[index] ?? null,
        changed: true,
      })
    }
    deleted = []
    inserted = []
  }

  for (const operation of operations) {
    if (operation.kind === "equal") {
      flushChanges()
      aligned.push({
        before: operation.line,
        after: operation.line,
        changed: false,
      })
    } else if (operation.kind === "delete") {
      deleted.push(operation.line)
    } else {
      inserted.push(operation.line)
    }
  }
  flushChanges()
  return aligned
}

const changedLineClassName = (side: "old" | "new") =>
  side === "old"
    ? "rounded-sm bg-[oklch(88%_0.07_25)] text-inherit dark:bg-[oklch(42%_0.07_25)]"
    : "rounded-sm bg-[oklch(88%_0.08_155)] text-inherit dark:bg-[oklch(42%_0.08_155)]"

const renderChangedText = (
  before: string,
  after: string,
  side: "old" | "new",
): ReactNode[] => {
  const parts: ReactNode[] = []
  for (const [index, [operation, text]] of diff(before, after).entries()) {
    if (operation === diff.EQUAL) {
      parts.push(text)
      continue
    }
    if (
      (side === "old" && operation === diff.INSERT) ||
      (side === "new" && operation === diff.DELETE)
    ) {
      continue
    }
    parts.push(
      <mark key={index} className={changedLineClassName(side)}>
        {text}
      </mark>,
    )
  }
  return parts
}

const AlignedValue = ({
  before,
  after,
  side,
}: {
  before: unknown
  after: unknown
  side: "old" | "new"
}) => {
  const beforeLines = show(before).split("\n")
  const afterLines = show(after).split("\n")
  const lines = alignLines(beforeLines, afterLines)

  return (
    <div className="whitespace-pre-wrap [overflow-wrap:anywhere]">
      {lines.map((line, index) => {
        const text = side === "old" ? line.before : line.after
        const otherText = side === "old" ? line.after : line.before
        return (
          <div key={index} className="min-h-[1.5em]">
            {text === null ? (
              " "
            ) : !line.changed ? (
              text || " "
            ) : otherText === null ? (
              <mark className={changedLineClassName(side)}>{text || " "}</mark>
            ) : (
              renderChangedText(
                side === "old" ? text : otherText,
                side === "new" ? text : otherText,
                side,
              )
            )}
          </div>
        )
      })}
    </div>
  )
}

const PermissionDiffTable: FunctionComponent<Props> = ({
  differences,
  source,
  snapshot,
}) => {
  const t = useTranslations()
  const byArch = new Map<string, Difference[]>()
  for (const difference of groupBusPolicies(
    (differences ?? []) as Difference[],
  )) {
    const arch = difference.path[0]
    byArch.set(arch, [...(byArch.get(arch) ?? []), difference])
  }

  return (
    <div className="flex min-w-0 flex-col gap-5 text-sm [--muted-foreground:var(--flathub-granite-gray)] dark:[--muted-foreground:var(--flathub-gray-x11)]">
      <p className="mb-0 text-sm text-muted-foreground">
        {t("moderation-permissions-compared-with", { source: source ?? "—" })}
      </p>
      {!source && snapshot && (
        <pre className="whitespace-pre-wrap break-all rounded bg-flathub-gainsborow p-3 text-xs dark:bg-flathub-dark-gunmetal">
          {JSON.stringify(snapshot, null, 2)}
        </pre>
      )}
      {Array.from(byArch, ([arch, rows]) => (
        <div key={arch} className="overflow-x-auto rounded-lg border">
          <table className="block w-full table-fixed border-collapse sm:table sm:min-w-[600px]">
            <caption className="block border-b bg-muted/60 px-4 py-3 text-start sm:table-caption">
              <span className="font-mono text-xs font-semibold">{arch}</span>
              <span className="ms-3 text-xs text-muted-foreground">
                {t("moderation-permissions-changed-count", {
                  count: rows.length,
                })}
              </span>
            </caption>
            <thead className="hidden sm:table-header-group">
              <tr className="border-b">
                {["key", "old-value", "new-value"].map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className={cn(
                      "px-4 py-3 text-start text-xs font-medium text-muted-foreground",
                      column === "old-value"
                        ? diffValueVariants({ kind: "removed" })
                        : column === "new-value"
                          ? diffValueVariants({ kind: "added" })
                          : undefined,
                    )}
                    data-diff={column}
                  >
                    {column === "old-value"
                      ? "− "
                      : column === "new-value"
                        ? "+ "
                        : ""}
                    {t(`moderation-${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="block sm:table-row-group">
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className="grid grid-cols-1 border-b align-top last:border-0 sm:table-row"
                >
                  <th
                    scope="row"
                    className="border-b bg-muted/40 px-4 py-4 text-start font-mono text-xs leading-relaxed font-medium [overflow-wrap:anywhere] sm:border-b-0 sm:bg-transparent"
                  >
                    {row.path.slice(1).join(" / ") || arch}
                  </th>
                  <td
                    data-diff="old-value"
                    data-label={t("moderation-old-value")}
                    className={cn(
                      diffValueClassName,
                      diffValueVariants({ kind: "removed" }),
                    )}
                  >
                    <AlignedValue
                      before={row.before}
                      after={row.after}
                      side="old"
                    />
                  </td>
                  <td
                    data-diff="new-value"
                    data-label={t("moderation-new-value")}
                    className={cn(
                      diffValueClassName,
                      diffValueVariants({ kind: "added" }),
                    )}
                  >
                    <AlignedValue
                      before={row.before}
                      after={row.after}
                      side="new"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

export default PermissionDiffTable
