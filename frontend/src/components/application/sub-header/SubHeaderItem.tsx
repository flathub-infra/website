import clsx from "clsx"

const SubHeaderItem = ({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) => {
  return (
    <button
      type="button"
      className={clsx(
        "flex min-w-0 flex-col items-center justify-start gap-2 [overflow-wrap:anywhere]",
        "px-3 py-3",
        "rounded-lg",
        "transition-colors duration-150",
        "hover:bg-flathub-dark-gunmetal/5 dark:hover:bg-flathub-lotion/5",
        "active:bg-flathub-dark-gunmetal/8 dark:active:bg-flathub-lotion/8",
        "text-flathub-dark-gunmetal dark:text-flathub-gainsborow",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flathub-celestial-blue",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default SubHeaderItem
