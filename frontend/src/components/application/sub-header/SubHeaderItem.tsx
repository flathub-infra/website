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
        "flex flex-col items-center justify-center gap-1",
        "px-3 py-2 flex-1 basis-[calc(33%-0.5rem)] sm:basis-0",
        "rounded-lg",
        "transition-colors duration-150",
        "hover:bg-flathub-dark-gunmetal/5 dark:hover:bg-flathub-lotion/5",
        "active:bg-flathub-dark-gunmetal/8 dark:active:bg-flathub-lotion/8",
        "text-flathub-dark-gunmetal dark:text-flathub-gainsborow",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flathub-celestial-blue/50",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default SubHeaderItem
