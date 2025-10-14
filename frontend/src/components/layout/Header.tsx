"use client"

import { useEffect, useState } from "react"
import { usePathname, Link } from "../../i18n/navigation"
import { XMarkIcon, Bars3Icon } from "@heroicons/react/24/solid"
import { OrganizationJsonLd } from "next-seo"
import { useTranslations, useLocale } from "next-intl"
import { IS_PRODUCTION } from "../../env"
import { useUserContext, useUserDispatch } from "../../context/user-info"
import Image from "next/image"
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react"
import { clsx } from "clsx"
import Avatar from "../user/Avatar"
import { getUserName } from "src/verificationProvider"
import { QueryClient, useMutation } from "@tanstack/react-query"

import logoToolbarSvg from "public/img/logo/flathub-logo-toolbar.svg"
import logoMini from "public/img/logo/flathub-logo-mini.svg"
import logoEmail from "public/img/logo/logo-horizontal-email.png"
import { AxiosError } from "axios"
import { doLogoutAuthLogoutPost, Permission, UserInfo } from "src/codegen"
import { getLangDir } from "rtl-detect"
import SearchBarWithSuspense from "./SearchBarWithSuspense"

const MobileMenuButton = ({ open }) => {
  const t = useTranslations()

  return (
    <PopoverButton className="inline-flex items-center justify-center rounded-md p-2 text-black transition hover:bg-black/5 dark:text-white dark:hover:bg-white/5 lg:hidden">
      <span className="sr-only">{t("open-menu")}</span>
      {open ? (
        <XMarkIcon className="block size-6" aria-hidden="true" />
      ) : (
        <Bars3Icon className="block size-6" aria-hidden="true" />
      )}
    </PopoverButton>
  )
}

const Header = () => {
  const t = useTranslations()
  const locale = useLocale()
  const pathname = usePathname()
  const user = useUserContext()
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null)
  const [clickedLogout, setClickedLogout] = useState(false)
  const dispatch = useUserDispatch()
  const [isScrolled, setIsScrolled] = useState(false)

  const navigation = [
    {
      name: t("publish"),
      href: "https://docs.flathub.org/docs/for-app-authors/submission",
      current: false,
    },
    {
      name: t("forum"),
      href: "https://discourse.flathub.org/",
      current: false,
    },
    { name: t("about"), href: "/about", current: false },
  ]

  let userNavigation = [
    { name: t("my-flathub"), href: "/my-flathub" },
    {
      name: t("view-wallet"),
      href: "/wallet",
      condition: (user: UserInfo) => !IS_PRODUCTION,
    },
    { name: t("developer-portal.title"), href: "/developer-portal" },
    {
      name: "Admin",
      href: "/admin",
      condition: (user: UserInfo) =>
        user?.permissions.some((a) => a === Permission.moderation) ||
        user?.permissions.some((a) => a === Permission["quality-moderation"]),
    },
    { name: t("settings"), href: "/settings" },
  ]

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        setIsScrolled(true)
      } else {
        setIsScrolled(false)
      }
    }

    handleScroll() // Check scroll position on mount

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const queryClient = new QueryClient()

  const logoutMutation = useMutation({
    mutationKey: ["logout"],
    mutationFn: () =>
      doLogoutAuthLogoutPost({
        credentials: "include",
      }),
    onSuccess: () => {
      dispatch({ type: "logout" })
      queryClient.clear()
    },
    onError: (err: AxiosError) => {
      dispatch({ type: "interrupt" })
      setClickedLogout(false)
    },
  })

  const onLogout = () => {
    // Only make a request on first logout click
    if (clickedLogout) return
    setClickedLogout(true)

    logoutMutation.mutate()
  }

  useEffect(() => {
    if (user.info) {
      const avatarUrl = user.info.default_account.avatar

      setUserAvatarUrl(avatarUrl)
    }
  }, [user.info])

  useEffect(() => {
    document.dir = getLangDir(locale)
  }, [locale])

  useEffect(() => {
    function focusSearchBar(e: KeyboardEvent) {
      const searchBarComponent = document.getElementById("search")

      if (
        searchBarComponent &&
        e.key === "/" &&
        (!document.activeElement ||
          !["input", "textarea"].includes(document.activeElement.localName))
      ) {
        e.preventDefault()
        searchBarComponent.focus()
      }
    }

    window.addEventListener("keydown", focusSearchBar)
    return () => {
      window.removeEventListener("keydown", focusSearchBar)
    }
  }, [])

  const displayNameWithFallback = getUserName(user.info)

  return (
    <>
      <Popover
        as="header"
        className={({ open }) =>
          clsx(
            open &&
              "fixed inset-0 overflow-y-auto bg-flathub-white dark:bg-flathub-arsenic",
            "fixed z-30 w-full lg:overflow-y-visible transition ease-in-out",
            isScrolled && "bg-flathub-white dark:bg-flathub-arsenic shadow-sm",
          )
        }
      >
        {({ open, close }) => (
          <>
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="relative flex justify-between lg:gap-8 xl:grid xl:grid-cols-12">
                <div className="flex md:absolute md:inset-y-0 md:start-0 lg:static xl:col-span-4">
                  <div className="flex h-full w-full shrink-0 items-center">
                    <OrganizationJsonLd
                      useAppDir={true}
                      name={t("flathub")}
                      url={`${process.env.NEXT_PUBLIC_SITE_BASE_URI}`}
                      logo={logoEmail.src}
                      sameAs={[
                        "https://docs.flathub.org/",
                        "https://discourse.flathub.org/",
                        "https://wikipedia.org/wiki/Flathub",
                        "https://fosstodon.org/@FlatpakApps",
                        "https://github.com/flathub",
                        "https://github.com/flathub-infra",
                      ]}
                    />
                    <Link href="/">
                      <div
                        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-black transition hover:bg-black/5 dark:text-white dark:invert dark:hover:bg-black/5 lg:w-fit lg:py-2 lg:pe-[14px] lg:ps-3"
                        title={t("go-home")}
                      >
                        <div className="hidden lg:block">
                          <Image
                            src={logoToolbarSvg}
                            alt={t("flathub-logo")}
                            width={88}
                            height={24}
                            priority
                          />
                        </div>
                        <div className="block lg:hidden">
                          <Image
                            src={logoMini}
                            alt={t("flathub-logo")}
                            width={24}
                            height={22}
                            style={{ width: 24, height: 22 }}
                            priority
                          />
                        </div>
                      </div>
                    </Link>
                  </div>
                </div>
                <div className="min-w-0 flex-1 md:px-8 lg:px-0 xl:col-span-4">
                  <div className="flex items-center px-6 py-4 md:mx-auto md:max-w-3xl lg:mx-0 lg:max-w-none xl:px-0">
                    <div className="w-full xl:mx-auto xl:w-[400px]">
                      <SearchBarWithSuspense />
                    </div>
                  </div>
                </div>
                <div className="flex items-center md:absolute md:inset-y-0 md:end-0 lg:hidden">
                  <MobileMenuButton open={open} />
                </div>
                <div className="hidden lg:flex lg:items-center lg:justify-end xl:col-span-4">
                  {navigation.map((item) => {
                    if (item.href.startsWith("http")) {
                      return (
                        <a
                          href={item.href}
                          key={item.name}
                          target="_blank"
                          rel="noreferrer"
                          className="ms-4 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-black transition hover:bg-black/5 dark:text-white dark:hover:bg-white/5"
                        >
                          {item.name}
                        </a>
                      )
                    } else {
                      return (
                        <Link
                          href={item.href}
                          key={item.name}
                          className="ms-4 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-black transition hover:bg-black/5 dark:text-white dark:hover:bg-white/5"
                        >
                          {item.name}
                        </Link>
                      )
                    }
                  })}
                  {!user.info && (
                    <Link
                      href={`/login?returnTo=${encodeURIComponent(pathname)}`}
                      key="login"
                      className="ms-4 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-black transition hover:bg-black/5 dark:text-white dark:hover:bg-white/5"
                    >
                      {t("login")}
                    </Link>
                  )}

                  {/* Profile dropdown */}
                  {user.info && (
                    <Menu as="div" className="relative ms-5">
                      <div>
                        <MenuButton className="flex rounded-full bg-white">
                          <span className="sr-only">{t("open-user-menu")}</span>
                          <Avatar
                            userName={displayNameWithFallback}
                            avatarUrl={userAvatarUrl}
                          />
                        </MenuButton>
                      </div>
                      <Transition
                        enter="transition ease-out duration-100"
                        enterFrom="transform opacity-0 scale-95"
                        enterTo="transform opacity-100 scale-100"
                        leave="transition ease-in duration-75"
                        leaveFrom="transform opacity-100 scale-100"
                        leaveTo="transform opacity-0 scale-95"
                      >
                        <MenuItems className="absolute end-0 z-10 mt-2 w-48 origin-top-right rounded-xl bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-hidden dark:border dark:border-flathub-granite-gray dark:bg-flathub-arsenic">
                          {userNavigation
                            .filter(
                              (nav) =>
                                !nav.condition || nav.condition(user?.info),
                            )
                            .map((item) => (
                              <MenuItem key={item.name}>
                                {({ focus }) => (
                                  <Link
                                    href={item.href}
                                    className={clsx(
                                      focus
                                        ? "bg-flathub-gainsborow/50 dark:bg-flathub-granite-gray"
                                        : "",
                                      "block px-4 py-2 text-sm text-flathub-dark-gunmetal transition first:rounded-t-md hover:opacity-75 dark:bg-flathub-arsenic dark:text-flathub-white",
                                    )}
                                  >
                                    {item.name}
                                  </Link>
                                )}
                              </MenuItem>
                            ))}
                          <MenuItem key="logout">
                            {({ focus }) => (
                              <button
                                onClick={onLogout}
                                className={clsx(
                                  focus
                                    ? "bg-flathub-gainsborow/50 dark:bg-flathub-granite-gray"
                                    : "",
                                  "block w-full rounded-b-md px-4 py-2 text-start text-sm font-normal text-flathub-dark-gunmetal transition hover:opacity-75 dark:bg-flathub-arsenic dark:text-flathub-white",
                                )}
                              >
                                {t("log-out")}
                              </button>
                            )}
                          </MenuItem>
                        </MenuItems>
                      </Transition>
                    </Menu>
                  )}
                </div>
              </div>
            </div>

            <PopoverPanel as="nav" className="lg:hidden" aria-label="Global">
              {({ close }) => (
                <>
                  <div className="mx-auto max-w-3xl space-y-1 px-2 pb-3 pt-2 sm:px-4">
                    {navigation.map((item) => {
                      if (item.href.startsWith("http")) {
                        return (
                          <a
                            key={item.name}
                            href={item.href}
                            target="_blank"
                            rel="noreferrer"
                            aria-current={item.current ? "page" : undefined}
                            className={clsx(
                              item.current
                                ? "bg-white/5"
                                : "hover:bg-black/5 dark:hover:bg-white/5",
                              "block rounded-md px-3 py-2 text-base font-medium text-black transition dark:text-flathub-gainsborow",
                            )}
                          >
                            {item.name}
                          </a>
                        )
                      } else {
                        return (
                          <Link
                            href={item.href}
                            key={item.name}
                            onClick={() => {
                              navigation.forEach((nav) => {
                                nav.current = nav.name === item.name
                              })
                              close()
                            }}
                            aria-current={item.current ? "page" : undefined}
                            className={clsx(
                              item.current
                                ? "bg-white/5"
                                : "hover:bg-black/5 dark:hover:bg-white/5",
                              "block rounded-md px-3 py-2 text-base font-medium text-black transition dark:text-flathub-gainsborow",
                            )}
                          >
                            {t(item.name)}
                          </Link>
                        )
                      }
                    })}
                    {!user.info && (
                      <Link
                        href="/login"
                        key="login"
                        className={clsx(
                          "block rounded-md px-3 py-2 text-base font-medium text-black transition hover:bg-black/5 dark:text-flathub-gainsborow dark:hover:bg-white/5",
                        )}
                        onClick={() => {
                          close()
                        }}
                      >
                        {t("login")}
                      </Link>
                    )}
                  </div>
                  {user.info && (
                    <div className="border-t border-gray-200 pb-3 pt-4 dark:border-zinc-600">
                      <div className="mx-auto flex max-w-3xl items-center px-4 sm:px-6">
                        <div className="shrink-0">
                          <Image
                            className="rounded-full"
                            src={user.info.default_account.avatar}
                            width="38"
                            height="38"
                            alt={t("user-avatar", {
                              user: displayNameWithFallback,
                            })}
                            priority
                          />
                        </div>
                        <div className="ms-3">
                          <div className="text-base font-medium text-black dark:text-flathub-gainsborow ">
                            {displayNameWithFallback}
                          </div>
                        </div>
                      </div>
                      <div className="mx-auto mt-3 max-w-3xl space-y-1 px-2 sm:px-4">
                        {userNavigation
                          .filter(
                            (nav) =>
                              !nav.condition || nav.condition(user?.info),
                          )
                          .map((item) => (
                            <Link
                              key={item.name}
                              href={item.href}
                              className="block rounded-md px-3 py-2 text-base font-medium text-black transition hover:bg-black/5 dark:text-flathub-gainsborow dark:hover:bg-white/5"
                              onClick={() => {
                                close()
                              }}
                            >
                              {item.name}
                            </Link>
                          ))}
                        <button
                          key={"logout"}
                          onClick={() => {
                            onLogout()
                            close()
                          }}
                          className="block w-full rounded-md px-3 py-2 text-start text-base font-medium text-black transition hover:bg-black/5 dark:text-flathub-gainsborow dark:hover:bg-white/5"
                        >
                          {t("log-out")}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </PopoverPanel>
          </>
        )}
      </Popover>
    </>
  )
}

export default Header
