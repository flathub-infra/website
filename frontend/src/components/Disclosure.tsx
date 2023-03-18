import { Disclosure, Transition } from "@headlessui/react"
import { FunctionComponent, ReactElement } from "react"
import { HiChevronRight } from "react-icons/hi2"
import { clsx } from "clsx"

export const FlathubDisclosure: FunctionComponent<{
  buttonItems: ReactElement | ReactElement[]
  children: ReactElement | ReactElement[]
}> = ({ buttonItems, children }): ReactElement => {
  return (
    <Disclosure>
      {({ open }) => (
        <>
          <Disclosure.Button className="flex w-full items-center gap-3 px-4 py-3">
            <HiChevronRight
              className={clsx(
                open ? "rotate-90 " : "",
                "h-6 w-6 transform text-flathub-sonic-silver duration-150 dark:text-flathub-spanish-gray",
              )}
            />
            {buttonItems}
          </Disclosure.Button>
          <Transition
            enter="transition duration-100 ease-out"
            enterFrom="transform scale-95 opacity-0"
            enterTo="transform scale-100 opacity-100"
            leave="transition duration-75 ease-out"
            leaveFrom="transform scale-100 opacity-100"
            leaveTo="transform scale-95 opacity-0"
          >
            <Disclosure.Panel className={"px-4"}>{children}</Disclosure.Panel>
          </Transition>
        </>
      )}
    </Disclosure>
  )
}
