import { ComponentProps } from "react"
import { cn } from "@/lib/utils"

const ButtonGroup = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    role="group"
    data-slot="button-group"
    className={cn(
      "inline-flex w-fit items-stretch [&>*]:focus-visible:relative [&>*]:focus-visible:z-10 [&>*:not(:first-child)]:rounded-s-none [&>*:not(:first-child)]:border-s-0 [&>*:not(:last-child)]:rounded-e-none",
      className,
    )}
    {...props}
  />
)

export { ButtonGroup }
