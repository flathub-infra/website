import { Tab } from "@headlessui/react"
import { Fragment, FunctionComponent } from "react"
import { clsx } from "clsx"

interface Props {
  tabs: {
    name: string
    content: JSX.Element
    badge?: string | number
  }[]
}

/** A link placed at the top of a page's main container to return to some other page */
const Tabs: FunctionComponent<Props> = ({ tabs }) => {
  return (
    <>
      <Tab.Group>
        <Tab.List className="flex gap-3 rounded-t-xl bg-flathub-white px-3 shadow-md dark:bg-flathub-arsenic">
          {tabs.map((tab, index) => (
            <Tab key={index} as={Fragment}>
              {({ selected }) => (
                <button
                  className={clsx(
                    selected
                      ? "border-flathub-celestial-blue text-flathub-dark-gunmetal dark:text-flathub-gainsborow"
                      : "border-transparent text-flathub-arsenic hover:border-flathub-gray-x11 hover:text-flathub-dark-gunmetal dark:text-flathub-gray-x11 dark:hover:text-flathub-gainsborow",
                    "flex whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition focus:outline-none",
                  )}
                >
                  {tab.name}
                  {!!tab.badge && (
                    <span
                      className={clsx(
                        "ml-2 inline-flex items-center rounded-md bg-flathub-celestial-blue px-2 py-1 text-xs font-medium text-flathub-black dark:text-flathub-white",
                      )}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              )}
            </Tab>
          ))}
        </Tab.List>
        <Tab.Panels>
          {tabs.map((tab, index) => (
            <Tab.Panel
              key={index}
              className="rounded-b-xl bg-flathub-white p-4 shadow-md dark:bg-flathub-arsenic"
            >
              {tab.content}
            </Tab.Panel>
          ))}
        </Tab.Panels>
      </Tab.Group>
    </>
  )
}

export default Tabs
