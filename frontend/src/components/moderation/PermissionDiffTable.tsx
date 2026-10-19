import { FunctionComponent } from "react"
import { useTranslations } from "next-intl"
import { cva } from "class-variance-authority"
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

const PermissionDiffTable: FunctionComponent<Props> = ({
  differences,
  source,
  snapshot,
}) => {
  const t = useTranslations()
  const byArch = new Map<string, Difference[]>()
  for (const difference of (differences ?? []) as Difference[]) {
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
                    {show(row.before)}
                  </td>
                  <td
                    data-diff="new-value"
                    data-label={t("moderation-new-value")}
                    className={cn(
                      diffValueClassName,
                      diffValueVariants({ kind: "added" }),
                    )}
                  >
                    {show(row.after)}
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
