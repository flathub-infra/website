import type { JSX } from "react"
export const StackedListBox = ({
  items,
}: {
  items: {
    id: number
    header: string
    description?: string
    icon?: JSX.Element
  }[]
}) => {
  return (
    <ul className="flex flex-col rounded-xl bg-flathub-lotion dark:bg-flathub-arsenic/80 ring-1 ring-flathub-gainsborow/60 dark:ring-flathub-granite-gray/30 divide-y divide-flathub-gainsborow/40 dark:divide-flathub-granite-gray/30">
      {items.map((x) => (
        <li key={x.id} className="flex items-center gap-3 px-5 py-3">
          <div className="flex-shrink-0 flex items-center justify-center">
            {x.icon}
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="text-sm font-semibold leading-snug text-flathub-dark-gunmetal dark:text-flathub-gainsborow text-left">
              {x.header}
            </div>
            {x.description && (
              <div className="text-xs text-flathub-sonic-silver dark:text-flathub-spanish-gray leading-snug text-left whitespace-pre-line break-words">
                {x.description}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
