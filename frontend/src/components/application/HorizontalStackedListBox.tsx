import clsx from "clsx"

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
        "flex flex-col md:flex-row rounded-xl flex-grow",
        "shadow-md dark:bg-flathub-arsenic dark:divide-flathub-dark-gunmetal",
        "md:divide-x-2 md:divide-y-0 divide-y-2",
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
