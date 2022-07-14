import { FunctionComponent } from "react"

interface Props {
  condition: () => boolean
  error: string
}

/**
A wrapper component to conditionally render a feedback error message below
the child components when some condition is met.

The intended use case is for form inputs.
*/
const WithFeedback: FunctionComponent<Props> = ({
  condition,
  error,
  children,
}) => {
  return (
    <>
      {children}
      {condition() ? (
        <p role="alert" className="my-2 text-colorDanger">
          {error}
        </p>
      ) : (
        <></>
      )}
    </>
  )
}

export default WithFeedback
