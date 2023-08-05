import { useCollapse } from "@collapsed/react"
import clsx from "clsx"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "next-i18next"

export const Description = ({ app }) => {
  const { t } = useTranslation()
  const collapsedHeight = 356

  const description = useMemo(
    () => (app.description ? app.description : ""),
    [app.description],
  )

  const [scrollHeight, setScrollHeight] = useState(0)

  const ref = useRef(null)

  useEffect(() => {
    setScrollHeight(ref.current.scrollHeight)
  }, [ref])

  const { getCollapseProps, getToggleProps, isExpanded } = useCollapse({
    collapsedHeight: collapsedHeight,
  })

  return (
    <>
      <div>
        <h2 className="my-4 text-xl font-semibold ">{app.summary}</h2>
        {scrollHeight > collapsedHeight && (
          <div
            {...getCollapseProps({ ref })}
            className={clsx(
              `prose relative transition-all dark:prose-invert xl:max-w-[75%]`,
              !isExpanded &&
                scrollHeight > collapsedHeight &&
                "from-flathub-white before:absolute before:bottom-0 before:left-0 before:h-1/3 before:w-full before:bg-gradient-to-t before:content-[''] dark:from-flathub-dark-gunmetal",
            )}
            dangerouslySetInnerHTML={{
              __html: description,
            }}
          />
        )}
        {scrollHeight <= collapsedHeight && (
          <div
            className={`prose dark:prose-invert xl:max-w-[75%]`}
            ref={ref}
            dangerouslySetInnerHTML={{
              __html: description,
            }}
          />
        )}
      </div>

      {scrollHeight > collapsedHeight && (
        <button {...getToggleProps()}>
          <span className="m-0 w-full rounded-xl bg-flathub-white px-6 py-2 font-semibold shadow-md transition hover:cursor-pointer hover:bg-flathub-white dark:bg-flathub-arsenic/80 hover:dark:bg-flathub-arsenic">
            {isExpanded ? t(`show-less`) : t(`show-more`)}
          </span>
        </button>
      )}
    </>
  )
}
