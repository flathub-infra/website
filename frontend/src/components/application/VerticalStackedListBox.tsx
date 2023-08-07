const Item = ({ children }: { children: JSX.Element | JSX.Element[] }) => {
  return <li className={`flex justify-center w-full`}>{children}</li>
}

export const VerticalStackedListBox = ({
  children,
}: {
  children: JSX.Element[] | JSX.Element
}) => {
  return (
    <ul className="flex shadow-md dark:bg-flathub-arsenic rounded-xl divide-x-4 dark:divide-flathub-dark-gunmetal flex-grow">
      {Array.isArray(children) ? (
        children.map((child, i) => <Item key={i}>{child}</Item>)
      ) : (
        <Item>{children}</Item>
      )}
    </ul>
  )
}
