"use client"

import clsx from "clsx"
import { ReactNode, useEffect } from "react"
import { Permission, GetUserinfoAuthUserinfoGet200 } from "src/codegen"
import LoginGuard from "./login/LoginGuard"
import { useUserContext } from "src/context/user-info"
import FlathubListbox from "./FlathubListbox"
import { usePathname, useRouter } from "src/i18n/navigation"

const AdminLayoutClient = ({
  children,
  condition,
}: {
  children: ReactNode
  condition?: (user: GetUserinfoAuthUserinfoGet200) => boolean
}) => {
  const router = useRouter()
  const pathname = usePathname()

  const user = useUserContext()

  const adminNavigationGroups = [
    {
      name: "Review",
      items: [
        {
          name: "Moderation",
          href: "/admin/moderation",
          condition: (user: GetUserinfoAuthUserinfoGet200) =>
            user?.permissions.some((a) => a === Permission.moderation),
        },
        {
          name: "Permission reviews",
          href: "/admin/moderation/permissions",
          condition: (user: GetUserinfoAuthUserinfoGet200) =>
            user?.permissions.some((a) => a === Permission.moderation),
        },
        {
          name: "Maintenance Radar",
          href: "/admin/maintenance",
          condition: (user: GetUserinfoAuthUserinfoGet200) =>
            user?.permissions.some((a) => a === Permission.moderation),
        },
        {
          name: "Permission statistics",
          href: "/admin/permission-statistics",
          condition: (user: GetUserinfoAuthUserinfoGet200) =>
            user?.permissions.some((a) => a === Permission.moderation),
        },
      ],
    },
    {
      name: "Curation",
      items: [
        {
          name: "Quality Moderation",
          href: "/admin/quality-moderation",
          condition: (user: GetUserinfoAuthUserinfoGet200) =>
            user?.permissions.some(
              (a) => a === Permission["quality-moderation"],
            ),
        },
        {
          name: "App Picks",
          href: "/admin/app-picks",
          condition: (user: GetUserinfoAuthUserinfoGet200) =>
            user?.permissions.some(
              (a) => a === Permission["quality-moderation"],
            ),
        },
        {
          name: "Homepage Selections",
          href: "/admin/homepage-selections",
          condition: (user: GetUserinfoAuthUserinfoGet200) =>
            user?.permissions.some(
              (a) => a === Permission["quality-moderation"],
            ),
        },
      ],
    },
    {
      name: "People & access",
      items: [
        {
          name: "Users",
          href: "/admin/users",
          condition: (user: GetUserinfoAuthUserinfoGet200) =>
            user?.permissions.some((a) => a === Permission["view-users"]),
        },
        {
          name: "Roles",
          href: "/admin/roles",
          condition: (user: GetUserinfoAuthUserinfoGet200) =>
            user?.permissions.some((a) => a === Permission["view-users"]),
        },
        {
          name: "Direct uploads",
          href: "/admin/direct-uploads",
          condition: (user: GetUserinfoAuthUserinfoGet200) =>
            user?.permissions.some((a) => a === Permission["modify-users"]),
        },
        {
          name: "OIDC clients",
          href: "/admin/oidc-clients",
          condition: (user: GetUserinfoAuthUserinfoGet200) =>
            user?.permissions.some(
              (a) => a === Permission["manage-oidc-clients"],
            ),
        },
      ],
    },
  ]
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.condition(user?.info)),
    }))
    .filter((group) => group.items.length > 0)

  const adminNavigation = adminNavigationGroups.flatMap((group) => group.items)

  useEffect(() => {
    if (adminNavigation.length > 0 && pathname.endsWith("/admin")) {
      router.push(adminNavigation[0].href)
    }
  }, [adminNavigation, pathname, router])

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
            selected: pathname === item.href,
            disabled: !item.condition || !item.condition(user?.info),
          }))}
        />
        <aside
          className={clsx(
            "lg:col-start-1 lg:row-start-1 lg:col-span-2 hidden ps-6",
            adminNavigation.length > 1 && "lg:block",
          )}
        >
          <nav className="flex flex-1 flex-col" aria-label="Sidebar">
            {adminNavigationGroups.map((group) => (
              <section key={group.name} className="mb-5 last:mb-0">
                <h2 className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-flathub-black/55 dark:text-flathub-white/55">
                  {group.name}
                </h2>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.name}>
                      <a
                        href={item.href}
                        aria-current={
                          pathname === item.href ? "page" : undefined
                        }
                        className={clsx(
                          pathname === item.href
                            ? "bg-flathub-gainsborow text-flathub-black dark:bg-flathub-arsenic dark:text-flathub-white"
                            : "text-flathub-black hover:bg-flathub-gainsborow/50 dark:text-flathub-white dark:hover:bg-flathub-arsenic",
                          "group flex gap-x-3 rounded-md p-2 ps-3 text-sm leading-6 font-semibold",
                        )}
                      >
                        {item.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
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

export default AdminLayoutClient
