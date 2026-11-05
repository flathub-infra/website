import { useTranslations } from "next-intl"
import { FunctionComponent } from "react"
import ReviewCard from "./ReviewCard"
import { ModerationRequestResponse, RequestData } from "src/codegen"
import diff from "fast-diff"

interface Props {
  request: ModerationRequestResponse
  grouped?: boolean
}

const RANDOM_REVIEW_MARKER = "Randomly selected for human review"

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
  const hasValue = currentDiff.some(
    ([operation, value]) =>
      value.length > 0 &&
      operation !== (type === "old" ? diff.INSERT : diff.DELETE),
  )
  if (!hasValue) {
    return <span className="text-muted-foreground">—</span>
  }
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
          className="rounded-sm bg-flathub-status-green/20 text-foreground underline decoration-flathub-status-green underline-offset-4 dark:bg-flathub-status-green/20"
        >
          {a[1]}
        </mark>
      )
    }
    if (a[0] === diff.DELETE) {
      return (
        <mark
          key={i}
          className="rounded-sm bg-flathub-status-red/15 text-foreground dark:bg-flathub-status-red/20"
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
  const t = useTranslations()
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
      <td className="align-top px-4 py-3 font-mono text-xs text-muted-foreground">
        {valueKey}
      </td>
      {!is_new_submission && (
        <td
          data-label={t("moderation-old-value")}
          className="align-top px-4 py-3"
        >
          <div className="min-w-0">
            <ArrayWithNewlines
              array={currentValueList}
              diffForIndex={diffForIndex}
              type={"old"}
            />
          </div>
        </td>
      )}
      <td
        data-label={t(
          is_new_submission ? "moderation-value" : "moderation-new-value",
        )}
        className="align-top px-4 py-3"
      >
        <div className="min-w-0">
          <ArrayWithNewlines
            array={newValueList}
            diffForIndex={diffForIndex}
            type={"new"}
          />
        </div>
      </td>
    </tr>
  )
}

const DiffRow = ({
  valueKey,
  request,
  requestData,
}: {
  valueKey: string
  request: ModerationRequestResponse
  requestData: RequestData
}) => {
  const t = useTranslations()
  // can be string or string[]
  const currentValues = requestData.current_values[valueKey] as
    string | string[] | { [key: string]: string[] }
  const newValues = requestData.keys[valueKey] as
    string | string[] | { [key: string]: string[] }

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
        <td className="align-top px-4 py-3 font-mono text-xs text-muted-foreground">
          {valueKey}
        </td>
        {!request.is_new_submission && (
          <td
            data-label={t("moderation-old-value")}
            className="align-top px-4 py-3"
          >
            <div className="min-w-0">
              <MarkDiff diff={diffString} type="old" />
            </div>
          </td>
        )}
        <td
          data-label={t(
            request.is_new_submission
              ? "moderation-value"
              : "moderation-new-value",
          )}
          className="align-top px-4 py-3"
        >
          <div className="min-w-0">
            <MarkDiff diff={diffString} type="new" />
          </div>
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

const AppstreamChangesRow: FunctionComponent<Props> = ({
  request,
  grouped = false,
}) => {
  const t = useTranslations()
  const requestData = request.request_data
  if (!requestData || !("keys" in requestData)) {
    return null
  }

  const isRandomReview =
    requestData.keys.human_review === RANDOM_REVIEW_MARKER &&
    Object.keys(requestData.keys).length === 1 &&
    Object.keys(requestData.current_values).length === 0

  const currentValuesFiltered = Object.keys(requestData.current_values).filter(
    (a) =>
      // these keys are special, but we don't want to act on them - so ignore
      a !== "name" &&
      a !== "developer_name" &&
      a !== "project_license" &&
      a !== "summary",
  )

  const uniqueKeys = Array.from(
    new Set([...Object.keys(requestData.keys), ...currentValuesFiltered]),
  ).sort()

  const title = isRandomReview
    ? t("moderation-random-review")
    : request.request_type === "summary"
      ? t("moderation-summary-changes")
      : request.is_new_submission
        ? t("moderation-appstream")
        : t("moderation-appstream-changes")

  const content = (
    <>
      {isRandomReview ? (
        <div className="rounded-lg border border-flathub-gainsborow p-4 dark:border-flathub-dark-gunmetal">
          <p className="text-sm text-flathub-sonic-silver dark:text-flathub-spanish-gray">
            {t("moderation-random-review")}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full table-fixed text-sm leading-relaxed [overflow-wrap:anywhere] max-sm:[&_tr]:flex max-sm:[&_tr]:flex-col max-sm:[&_td]:block max-sm:[&_td]:py-2 max-sm:[&_td:first-child]:bg-muted/50 max-sm:[&_td:not(:first-child)]:grid max-sm:[&_td:not(:first-child)]:grid-cols-[4.5rem_minmax(0,1fr)] max-sm:[&_td:not(:first-child)]:gap-x-3 max-sm:[&_td:not(:first-child)]:before:font-sans max-sm:[&_td:not(:first-child)]:before:text-xs max-sm:[&_td:not(:first-child)]:before:font-semibold max-sm:[&_td:not(:first-child)]:before:text-muted-foreground max-sm:[&_td:not(:first-child)]:before:content-[attr(data-label)] [&_td:not(:first-child)]:font-mono [&_td:not(:first-child)]:text-[13px]">
            <thead className="max-sm:sr-only">
              <tr className="border-b border-border bg-muted/50 text-start">
                <th
                  scope="col"
                  className="w-1/5 px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-foreground/75"
                >
                  {t("moderation-key")}
                </th>
                {!request.is_new_submission && (
                  <th
                    scope="col"
                    className="w-2/5 px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-foreground/75"
                  >
                    {t("moderation-old-value")}
                  </th>
                )}
                <th
                  scope="col"
                  className="w-2/5 px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-foreground/75"
                >
                  {request.is_new_submission
                    ? t("moderation-value")
                    : t("moderation-new-value")}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {uniqueKeys.map((key) => (
                <DiffRow
                  key={key}
                  valueKey={key.toString()}
                  request={request}
                  requestData={requestData}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )

  if (grouped) {
    return (
      <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        {content}
      </section>
    )
  }

  return (
    <ReviewCard title={title} requests={[request]}>
      {content}
    </ReviewCard>
  )
}

export default AppstreamChangesRow
