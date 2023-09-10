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
    <ul className="flex flex-col shadow-md dark:bg-flathub-arsenic rounded-xl py-2 divide-y dark:divide-flathub-dark-gunmetal">
      {items.map((x) => (
        <li
          key={x.id}
          className="flex items-center gap-3 px-5 pb-2 pt-2 first:pt-0 last:pb-0"
        >
          <div>{x.icon}</div>
          <div className="flex flex-col gap-1">
            <div className="leading-none">{x.header}</div>
            {x.description && (
              <div className="text-xs text-flathub-sonic-silver dark:text-flathub-gray-x11 leading-none">
                {x.description}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
