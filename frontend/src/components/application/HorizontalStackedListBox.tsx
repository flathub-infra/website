import clsx from "clsx"

import type { JSX } from "react"

const Item = ({ children }: { children: JSX.Element | JSX.Element[] }) => {
  return <li className={`flex justify-center w-full`}>{children}</li>
}

export const HorizontalStackedListBox = ({
  children,
}: {
  children: JSX.Element[] | JSX.Element
}) => {
  return (
    <ul
      className={clsx(
        "flex flex-col sm:flex-row rounded-xl grow",
        "shadow-sm border border-flathub-gainsborow/80 bg-white divide-flathub-gainsborow dark:bg-flathub-arsenic dark:divide-flathub-dark-gunmetal dark:border-flathub-granite-gray/30",
        "sm:divide-x-2 sm:divide-y-0 divide-y-2",
      )}
    >
      {Array.isArray(children) ? (
        children.map((child, i) => <Item key={i}>{child}</Item>)
      ) : (
        <Item>{children}</Item>
      )}
    </ul>
  )
}
