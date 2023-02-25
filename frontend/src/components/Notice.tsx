import { FunctionComponent } from "react"

interface Props {
  variant?: "info" | "danger"
}

export const Notice: FunctionComponent<Props> = ({ variant, children }) => {
  var classes = {
    info: "border-flathub-celestial-blue",
    danger: "border-flathub-electric-red",
  }[variant ?? "info"]

  return (
    <>
      <div className={`${classes} rounded border p-3`}>{children}</div>
    </>
  )
}
