import Spinner from "../../src/components/Spinner"

export default function Loading() {
  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <div className="flex justify-center items-center min-h-[200px]">
        <Spinner size="m" />
      </div>
    </div>
  )
}
