import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react"
import { FunctionComponent, type JSX } from "react"
import { clsx } from "clsx"
import Badge from "./application/Badge"
import { LayoutGroup, motion } from "framer-motion"

export interface Tab {
  name: string
  content: JSX.Element
  badge?: string | number
  replacePadding?: string
}

interface Props {
  tabs: Tab[]
  tabsIdentifier: string
}

/** A link placed at the top of a page's main container to return to some other page */
const Tabs: FunctionComponent<Props> = ({ tabs, tabsIdentifier }) => {
  return (
    <>
      <TabGroup>
        <LayoutGroup
          id={tabsIdentifier + "-" + tabs.map((tab) => tab.name).join("-")}
        >
          <TabList className="flex flex-wrap gap-3 rounded-t-xl bg-flathub-white px-3 shadow-md dark:bg-flathub-arsenic">
            {tabs.map((tab, index) => (
              <Tab
                key={index}
                className={clsx(
                  "relative",
                  "flex whitespace-nowrap px-1 py-4 text-sm font-medium transition",
                  "focus:outline-none  data-[focus]:outline-1 data-[focus]:outline-flathub-celestial-blue",
                )}
              >
                {({ selected }) => (
                  <>
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
                          "absolute bottom-[-1px] start-0 end-0 h-1",
                          "bg-flathub-celestial-blue",
                        )}
                      />
                    )}
                  </>
                )}
              </Tab>
            ))}
          </TabList>
        </LayoutGroup>
        <TabPanels>
          {tabs.map((tab, index) => (
            <TabPanel
              key={index}
              className={clsx(
                tab.replacePadding ?? "p-4",
                "rounded-b-xl bg-flathub-white shadow-md dark:bg-flathub-arsenic",
                "focus:outline-none data-[focus]:outline-1 data-[focus]:outline-flathub-celestial-blue",
              )}
            >
              {tab.content}
            </TabPanel>
          ))}
        </TabPanels>
      </TabGroup>
    </>
  )
}

export default Tabs
