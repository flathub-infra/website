import { Tab } from "@headlessui/react"
import { Fragment, FunctionComponent } from "react"
import { clsx } from "clsx"
import Badge from "./application/Badge"
import { motion } from "framer-motion"

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
                    "relative",
                    "flex whitespace-nowrap px-1 py-4 text-sm font-medium transition focus:outline-none",
                  )}
                >
                  {tab.name}
                  {!!tab.badge && (
                    <span className="ms-1">
                      <Badge text={tab.badge.toString()}></Badge>
                    </span>
                  )}
                  {selected && (
                    <motion.div
                      layoutId="tab-indicator"
                      className={clsx(
                        "absolute bottom-[-1px] left-0 right-0 h-1",
                        "bg-flathub-celestial-blue",
                      )}
                    />
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
