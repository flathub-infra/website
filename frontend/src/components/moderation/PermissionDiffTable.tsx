import { FunctionComponent } from "react"
import { useTranslations } from "next-intl"

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
    <div className="space-y-4 text-sm">
      <p>
        {t("moderation-permissions-compared-with", { source: source ?? "—" })}
      </p>
      {!source && snapshot && (
        <pre className="whitespace-pre-wrap break-all rounded bg-flathub-gainsborow p-3 text-xs dark:bg-flathub-dark-gunmetal">
          {JSON.stringify(snapshot, null, 2)}
        </pre>
      )}
      {Array.from(byArch, ([arch, rows]) => (
        <table key={arch} className="w-full table-fixed border-collapse">
          <caption className="mb-2 text-start font-mono font-bold">
            {arch}
          </caption>
          <thead>
            <tr className="border-b border-flathub-gainsborow dark:border-flathub-dark-gunmetal">
              {["key", "old-value", "new-value"].map((column) => (
                <th key={column} className="w-1/3 py-2 text-start">
                  {t(`moderation-${column}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-flathub-gainsborow align-top dark:border-flathub-dark-gunmetal"
              >
                <td className="break-all py-2 pe-2 font-mono text-xs">
                  {row.path.slice(1).join(" / ") || arch}
                </td>
                <td className="whitespace-pre-wrap break-all py-2 pe-2 font-mono text-xs text-flathub-status-red-dark">
                  {show(row.before)}
                </td>
                <td className="whitespace-pre-wrap break-all py-2 font-mono text-xs text-flathub-status-green-dark">
                  {show(row.after)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  )
}

export default PermissionDiffTable
