import { Suspense, type ComponentProps } from "react"
import ApplicationCollection from "./Collection"
import Spinner from "../Spinner"

interface Props extends ComponentProps<typeof ApplicationCollection> {}

export default function ApplicationCollectionSuspense(props: Props) {
  return (
    <Suspense fallback={<Spinner size="m" />}>
      <ApplicationCollection {...props} />
    </Suspense>
  )
}
