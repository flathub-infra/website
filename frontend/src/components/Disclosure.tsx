import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Transition,
} from "@headlessui/react"
import { FunctionComponent, ReactElement } from "react"
import { ChevronRightIcon } from "@heroicons/react/24/solid"
import { clsx } from "clsx"

export const FlathubDisclosure: FunctionComponent<{
  buttonItems: ReactElement | ReactElement[]
  children: ReactElement | ReactElement[]
}> = ({ buttonItems, children }): ReactElement => {
  return (
    <Disclosure>
      <DisclosureButton className="group flex w-full items-center gap-3 px-4 py-3">
        <ChevronRightIcon
          className={clsx(
            "group-data-open:rotate-90",
            "size-6 transform text-flathub-sonic-silver duration-150 dark:text-flathub-spanish-gray",
          )}
        />
        {buttonItems}
      </DisclosureButton>
      <Transition
        enter="transition duration-100 ease-out"
        enterFrom="transform scale-95 opacity-0"
        enterTo="transform scale-100 opacity-100"
        leave="transition duration-75 ease-out"
        leaveFrom="transform scale-100 opacity-100"
        leaveTo="transform scale-95 opacity-0"
      >
        <DisclosurePanel className={"px-4"}>{children}</DisclosurePanel>
      </Transition>
    </Disclosure>
  )
}
