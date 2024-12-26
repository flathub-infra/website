import clsx from "clsx"
import { ReactNode, useEffect, useState } from "react"
import { Permission, UserInfo } from "src/codegen"
import LoginGuard from "./login/LoginGuard"
import { useRouter } from "next/router"
import { useUserContext } from "src/context/user-info"
import { Popover } from "@headlessui/react"
import { useTranslation } from "next-i18next"
import { HiBars3, HiXMark } from "react-icons/hi2"
import FlathubListbox from "./FlathubListbox"

const AdminLayout = ({
  children,
  condition,
}: {
  children: ReactNode
  condition?: (user: UserInfo) => boolean
}) => {
  const router = useRouter()

  const user = useUserContext()

  const adminNavigation = [
    {
      name: "Moderation",
      href: "/admin/moderation",
      condition: (user: UserInfo) =>
        user?.permissions.some((a) => a === Permission.moderation),
    },
    {
      name: "Quality Moderation",
      href: "/admin/quality-moderation",
      condition: (user: UserInfo) =>
        user?.permissions.some((a) => a === Permission["quality-moderation"]),
    },
    {
      name: "App Picks",
      href: "/admin/app-picks",
      condition: (user: UserInfo) =>
        user?.permissions.some((a) => a === Permission["quality-moderation"]),
    },
    {
      name: "Users",
      href: "/admin/users",
      condition: (user: UserInfo) =>
        user?.permissions.some((a) => a === Permission.moderation),
    },
    {
      name: "Roles",
      href: "/admin/roles",
      condition: (user: UserInfo) =>
        user?.permissions.some((a) => a === Permission.moderation),
    },
  ].filter((nav) => !nav.condition || nav.condition(user?.info))

  useEffect(() => {
    if (adminNavigation.length > 0 && router.pathname === "/admin") {
      router.push(adminNavigation[0].href)
    }
  }, [adminNavigation, router])

  return (
    <LoginGuard condition={condition}>
      <div className={clsx("grid grid-cols-12 gap-3")}>
        <FlathubListbox
          className={clsx(
            "col-span-10",
            "col-start-2",
            "row-start-1",
            "lg:hidden",
            adminNavigation.length === 1 && "hidden",
          )}
          items={adminNavigation.map((item) => ({
            id: item.name,
            content: item.name,
            onClick: () => router.push(item.href),
            selected: router.pathname === item.href,
            disabled: !item.condition || !item.condition(user?.info),
          }))}
        />
        <aside
          className={clsx(
            "lg:col-start-1 lg:row-start-1 lg:col-span-2 hidden",
            adminNavigation.length > 1 && "lg:block",
          )}
        >
          <nav className="flex flex-1 flex-col" aria-label="Sidebar">
            <ul role="list" className="space-y-1">
              {adminNavigation.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    className={clsx(
                      router.pathname === item.href
                        ? "bg-flathub-gainsborow text-flathub-celestial-blue dark:bg-flathub-arsenic dark:text-flathub-white"
                        : "text-flathub-black hover:text-flathub-celestial-blue hover:bg-flathub-gainsborow/50 dark:text-flathub-white dark:hover:bg-flathub-arsenic",
                      "group flex gap-x-3 rounded-md p-2 pl-3 text-sm leading-6 font-semibold",
                    )}
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main
          className={clsx(
            "",
            adminNavigation.length === 1
              ? "col-span-12"
              : "col-span-10 lg:col-span-10 col-start-2 lg:col-start-3 lg:row-span-2 lg:row-start-1",
          )}
        >
          {children}
        </main>
      </div>
    </LoginGuard>
  )
}

export default AdminLayout
