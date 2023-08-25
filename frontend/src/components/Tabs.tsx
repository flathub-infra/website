import { Tab } from "@headlessui/react"
import { Fragment, FunctionComponent } from "react"
import { clsx } from "clsx"
import Badge from "./application/Badge"
import { LayoutGroup, motion } from "framer-motion"

export interface Tab {
  name: string
  content: JSX.Element
  badge?: string | number
  noPadding?: boolean
}

interface Props {
  tabs: Tab[]
}

/** A link placed at the top of a page's main container to return to some other page */
const Tabs: FunctionComponent<Props> = ({ tabs }) => {
  return (
    <>
      <Tab.Group>
        <LayoutGroup id={tabs.map((tab) => tab.name).join("-")}>
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
        </LayoutGroup>
        <Tab.Panels>
          {tabs.map((tab, index) => (
            <Tab.Panel
              key={index}
              className={clsx(
                !tab.noPadding && "p-4",
                "rounded-b-xl bg-flathub-white shadow-md dark:bg-flathub-arsenic",
              )}
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
