import { useTranslations } from "next-intl"
import { FunctionComponent } from "react"
import ReviewCard from "./ReviewCard"
import { ModerationRequestResponse } from "src/codegen"
import diff from "fast-diff"

interface Props {
  request: ModerationRequestResponse
}
function alignArrays(a?: string[], b?: string[]): { a: string[]; b: string[] } {
  const orig = [a ?? [], b ?? []]

  const template = Array.from(
    new Set(orig.reduce((a, b) => a.concat(b))),
  ).sort()

  const result = orig.map((row) =>
    row.slice(0).reduce((output, val) => {
      const idx = template.indexOf(val)
      output[idx] = val
      return output
    }, Array(template.length).fill(null)),
  )

  return { a: result[0], b: result[1] }
}

const MarkDiff = ({
  diff: currentDiff,
  type,
}: {
  diff: diff.Diff[]
  type: "old" | "new"
}) => {
  return currentDiff.map((a, i) => {
    if (type === "new" && a[0] === diff.DELETE) {
      return null
    }
    if (type === "old" && a[0] === diff.INSERT) {
      return null
    }
    if (a[0] === diff.INSERT) {
      return (
        <mark
          key={i}
          className="dark:bg-flathub-status-green bg-flathub-status-green-dark dark:text-white"
        >
          {a[1]}
        </mark>
      )
    }
    if (a[0] === diff.DELETE) {
      return (
        <mark
          key={i}
          className="dark:bg-flathub-status-red bg-flathub-status-red-dark text-white"
        >
          {a[1]}
        </mark>
      )
    }

    return a[1]
  })
}

const ArrayWithNewlines = ({
  array,
  diffForIndex,
  type,
}: {
  array: string[]
  diffForIndex?: { [key: number]: diff.Diff[] }
  type: "old" | "new"
}) => {
  return array.map((v, i) => {
    return (
      <span key={i} className="break-all">
        {diffForIndex && <MarkDiff diff={diffForIndex[i]} type={type} />}
        {!diffForIndex && v}
        <br />
      </span>
    )
  })
}

const TableRow = ({
  valueKey,
  is_new_submission,
  currentValueList,
  newValueList,
}: {
  valueKey: string
  is_new_submission: boolean
  currentValueList: string[]
  newValueList: string[]
}) => {
  const length = Math.max(currentValueList.length, newValueList.length)

  const diffForIndex: { [key: number]: diff.Diff[] } = {}
  for (let index = 0; index < length; index++) {
    const diffResult = diff(
      currentValueList[index] ?? "",
      newValueList[index] ?? "",
    )

    diffForIndex[index] = diffResult
  }

  return (
    <tr key={valueKey}>
      <td className="align-top px-4 py-3 font-mono text-xs text-flathub-sonic-silver dark:text-flathub-spanish-gray">
        {valueKey}
      </td>
      {!is_new_submission && (
        <td className="align-top px-4 py-3">
          <ArrayWithNewlines
            array={currentValueList}
            diffForIndex={diffForIndex}
            type={"old"}
          />
        </td>
      )}
      <td className="align-top px-4 py-3">
        <ArrayWithNewlines
          array={newValueList}
          diffForIndex={diffForIndex}
          type={"new"}
        />
      </td>
    </tr>
  )
}

const DiffRow = ({
  valueKey,
  request,
}: {
  valueKey: string
  request: ModerationRequestResponse
}) => {
  // can be string or string[]
  const currentValues = request.request_data.current_values[valueKey] as
    | string
    | string[]
    | { [key: string]: string[] }
  const newValues = request.request_data.keys[valueKey] as
    | string
    | string[]
    | { [key: string]: string[] }

  if (Array.isArray(currentValues) || Array.isArray(newValues)) {
    if (JSON.stringify(currentValues) === JSON.stringify(newValues)) {
      return null
    }

    const { a: currentValueList, b: newValueList } = alignArrays(
      currentValues as string[],
      newValues as string[],
    )

    return (
      <TableRow
        key={valueKey}
        valueKey={valueKey}
        is_new_submission={request.is_new_submission}
        currentValueList={currentValueList}
        newValueList={newValueList}
      />
    )
  }

  if (
    typeof currentValues === "string" ||
    typeof newValues === "string" ||
    typeof currentValues === "boolean" ||
    typeof newValues === "boolean"
  ) {
    const diffString = diff(
      currentValues?.toString() ?? "",
      newValues?.toString() ?? "",
    )

    return (
      <tr>
        <td className="align-top px-4 py-3 font-mono text-xs text-flathub-sonic-silver dark:text-flathub-spanish-gray">
          {valueKey}
        </td>
        {!request.is_new_submission && (
          <td className="align-top px-4 py-3">
            <MarkDiff diff={diffString} type="old" />
          </td>
        )}
        <td className="align-top px-4 py-3">
          <MarkDiff diff={diffString} type="new" />
        </td>
      </tr>
    )
  }

  if (typeof currentValues === "object" || typeof newValues === "object") {
    const uniqueKeys = Array.from(
      new Set([
        ...Object.keys(currentValues ?? []),
        ...Object.keys(newValues ?? []),
      ]),
    ).sort()

    return (
      <>
        {uniqueKeys.map((key) => {
          // handle arrays
          if (
            (currentValues?.[key] && Array.isArray(currentValues[key])) ||
            (newValues?.[key] && Array.isArray(newValues[key]))
          ) {
            if (
              JSON.stringify(currentValues?.[key]) ===
              JSON.stringify(newValues?.[key])
            ) {
              return null
            }

            const { a: currentValueList, b: newValueList } = alignArrays(
              currentValues?.[key],
              newValues?.[key],
            )

            return (
              <TableRow
                key={valueKey}
                valueKey={valueKey}
                is_new_submission={request.is_new_submission}
                currentValueList={currentValueList}
                newValueList={newValueList}
              />
            )
          }
        })}
      </>
    )
  }
}

const AppstreamChangesRow: FunctionComponent<Props> = ({ request }) => {
  const t = useTranslations()

  const currentValuesFiltered = Object.keys(
    request.request_data?.current_values ?? {},
  ).filter(
    (a) =>
      // these keys are special, but we don't want to act on them - so ignore
      a !== "name" &&
      a !== "developer_name" &&
      a !== "project_license" &&
      a !== "summary",
  )

  const uniqueKeys = Array.from(
    new Set([
      ...Object.keys(request.request_data?.keys ?? {}),
      ...currentValuesFiltered,
    ]),
  ).sort()

  return (
    <ReviewCard
      title={
        request.is_new_submission
          ? t("moderation-appstream")
          : t("moderation-appstream-changes")
      }
      request={request}
    >
      <div className="overflow-x-auto rounded-lg border border-flathub-gainsborow dark:border-flathub-dark-gunmetal">
        <table className="w-full">
          <thead>
            <tr className="border-b border-flathub-gainsborow bg-flathub-gainsborow/30 text-left dark:border-flathub-dark-gunmetal dark:bg-flathub-dark-gunmetal/30 rtl:text-right">
              <th className="w-1/5 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-flathub-sonic-silver dark:text-flathub-spanish-gray">
                {t("moderation-key")}
              </th>
              {!request.is_new_submission && (
                <th className="w-2/5 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-flathub-sonic-silver dark:text-flathub-spanish-gray">
                  {t("moderation-old-value")}
                </th>
              )}
              <th className="w-2/5 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-flathub-sonic-silver dark:text-flathub-spanish-gray">
                {request.is_new_submission
                  ? t("moderation-value")
                  : t("moderation-new-value")}
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-flathub-gainsborow bg-flathub-white dark:divide-flathub-dark-gunmetal dark:bg-flathub-arsenic">
            {uniqueKeys.map((key) => (
              <DiffRow key={key} valueKey={key.toString()} request={request} />
            ))}
          </tbody>
        </table>
      </div>
    </ReviewCard>
  )
}

export default AppstreamChangesRow
