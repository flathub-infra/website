import { FunctionComponent } from "react"

interface Props {
  shown: boolean
  error: string
}

/**
A component to conditionally render a feedback error message when some condition is met.

Typical UX is to show an error on form input blur event, then hide it on form input changed event.
*/
const InlineError: FunctionComponent<Props> = ({ shown, error }) => {
  return shown ? (
    <p role="alert" className="my-2 text-colorDanger">
      {error}
    </p>
  ) : (
    <></>
  )
}

export default InlineError
