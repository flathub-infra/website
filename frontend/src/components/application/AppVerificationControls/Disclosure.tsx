import { Disclosure, Transition } from "@headlessui/react"
import { FunctionComponent, ReactElement } from "react"
import { HiChevronRight } from "react-icons/hi2"

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ")
}

export const FlathubDisclosure: FunctionComponent<{
  buttonText: string
  children: ReactElement | ReactElement[]
}> = ({ buttonText, children }): ReactElement => {
  return (
    <Disclosure>
      {({ open }) => (
        <>
          <Disclosure.Button className="flex w-full items-center gap-3 bg-bgColorSecondary px-4 py-3">
            <HiChevronRight
              className={classNames(
                open ? "rotate-90 " : "",
                "h-6 w-6 transform text-textSecondary duration-150",
              )}
            />
            <h4 className="text-xl font-medium">{buttonText}</h4>
          </Disclosure.Button>
          <Transition
            enter="transition duration-100 ease-out"
            enterFrom="transform scale-95 opacity-0"
            enterTo="transform scale-100 opacity-100"
            leave="transition duration-75 ease-out"
            leaveFrom="transform scale-100 opacity-100"
            leaveTo="transform scale-95 opacity-0"
          >
            <Disclosure.Panel>{children}</Disclosure.Panel>
          </Transition>
        </>
      )}
    </Disclosure>
  )
}
