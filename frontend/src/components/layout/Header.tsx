import { ChangeEvent, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import { HiMagnifyingGlass, HiXMark, HiBars3 } from "react-icons/hi2"
import { useWindowSize } from "src/hooks/useWindowSize"
import { LogoJsonLd, SiteLinksSearchBoxJsonLd } from "next-seo"
import { useTranslation } from "next-i18next"
import { IS_PRODUCTION } from "../../env"
import { useUserContext, useUserDispatch } from "../../context/user-info"
import Image from "next/image"
import { Fragment } from "react"
import { Menu, Popover, Transition } from "@headlessui/react"
import { toast } from "react-toastify"
import { logout } from "src/asyncs/login"
import { clsx } from "clsx"
import Avatar from "../user/Avatar"
import { UserInfo } from "src/types/Login"
import { getUserName } from "src/verificationProvider"

const navigation = [
  {
    name: "publish",
    href: "https://docs.flathub.org/docs/for-app-authors/submission",
    current: false,
  },
  { name: "forum", href: "https://discourse.flathub.org/", current: false },
  { name: "about", href: "/about", current: false },
]

let userNavigation = [
  { name: "my-flathub", href: "/my-flathub" },
  {
    name: "Moderation Dashboard",
    href: "/moderation",
    condition: (user: UserInfo) => user?.["is-moderator"],
  },
]

if (!IS_PRODUCTION)
  userNavigation.push({ name: "view-wallet", href: "/wallet" })

const MobileMenuButton = ({ open, close, width }) => {
  const { t } = useTranslation()

  useEffect(() => {
    if (open && width >= 1024) {
      close()
    }
  }, [close, open, width])

  return (
    <Popover.Button className="inline-flex items-center justify-center rounded-md p-2 text-black transition hover:bg-black/5 focus:outline-none dark:text-white dark:hover:bg-white/5">
      <span className="sr-only">{t("open-menu")}</span>
      {open ? (
        <HiXMark className="block h-6 w-6" aria-hidden="true" />
      ) : (
        <HiBars3 className="block h-6 w-6" aria-hidden="true" />
      )}
    </Popover.Button>
  )
}

const Header = () => {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const user = useUserContext()
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const size = useWindowSize()
  const [clickedLogout, setClickedLogout] = useState(false)
  const dispatch = useUserDispatch()

  const onLogout = useCallback(async () => {
    // Only make a request on first logout click
    if (clickedLogout) return
    setClickedLogout(true)

    try {
      logout(dispatch)
    } catch (err) {
      toast.error(t(err))
      setClickedLogout(false)
    }
  }, [clickedLogout, dispatch, t])

  useEffect(() => {
    if (user.info) {
      const avatarUrl = Object.values(user.info.auths).find(
        (auth) => auth.avatar,
      ).avatar

      setUserAvatarUrl(avatarUrl)
    }
  }, [user.info])

  useEffect(() => {
    document.dir = i18n.dir()
  }, [i18n, i18n.language])

  useEffect(() => {
    const q = router.query.query as string
    if (q) {
      setQuery(q)
    }
  }, [router.query.query])

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    setQuery(e.target.value)
  }

  const onSubmit = (e: ChangeEvent<HTMLFormElement>) => {
    e.preventDefault()
    const disallowedQueries = [".", ".."]
    if (!disallowedQueries.includes(query)) {
      const queryEncoded = encodeURIComponent(query).replace(/\./g, "%2E")
      router.push(
        `/apps/search${queryEncoded ? `?q=${queryEncoded}` : ""}`,
        undefined,
        {
          locale: router.locale,
        },
      )
    }
  }

  function onClickSearch(): void {
    const disallowedQueries = [".", ".."]
    if (!disallowedQueries.includes(query)) {
      const queryEncoded = encodeURIComponent(query).replace(/\./g, "%2E")
      router.push(
        `/apps/search${queryEncoded ? `?q=${queryEncoded}` : ""}`,
        undefined,
        {
          locale: router.locale,
        },
      )
    }
  }

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
            open ? "fixed inset-0 overflow-y-auto" : "",
            "fixed z-40 w-full bg-flathub-white shadow dark:bg-flathub-arsenic lg:overflow-y-visible",
          )
        }
      >
        {({ open, close }) => (
          <>
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="relative flex justify-between lg:gap-8 xl:grid xl:grid-cols-12">
                <div className="flex md:absolute md:inset-y-0 md:start-0 lg:static xl:col-span-4">
                  <div className="flex h-full w-full flex-shrink-0 items-center">
                    <LogoJsonLd
                      logo={`${process.env.NEXT_PUBLIC_SITE_BASE_URI}/img/logo/flathub-logo-toolbar.svg`}
                      url={`${process.env.NEXT_PUBLIC_SITE_BASE_URI}`}
                    />
                    <Link href="/" passHref>
                      <div
                        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-black transition hover:bg-black/5 dark:text-white dark:invert dark:hover:bg-black/5 lg:w-fit lg:py-2 lg:pe-[14px] lg:ps-3"
                        title={t("go-home")}
                      >
                        <div className="hidden lg:block">
                          <Image
                            src="/img/logo/flathub-logo-toolbar.svg"
                            alt="Flathub Logo"
                            width={88}
                            height={24}
                          />
                        </div>
                        <div className="block lg:hidden">
                          <Image
                            src="/img/logo/flathub-logo-mini.svg"
                            alt="Flathub Logo"
                            width={24}
                            height={22}
                          />
                        </div>
                      </div>
                    </Link>
                  </div>
                </div>
                <search className="min-w-0 flex-1 md:px-8 lg:px-0 xl:col-span-4">
                  <div className="flex items-center px-6 py-4 md:mx-auto md:max-w-3xl lg:mx-0 lg:max-w-none xl:px-0">
                    <div className="w-full xl:mx-auto xl:w-[400px]">
                      <SiteLinksSearchBoxJsonLd
                        url={process.env.NEXT_PUBLIC_SITE_BASE_URI}
                        potentialActions={[
                          {
                            target: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/search?q`,
                            queryInput: "search_term_string",
                          },
                        ]}
                      />
                      <label htmlFor="search" className="sr-only">
                        {t("search-apps")}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 start-0 flex items-center ps-2">
                          <button
                            className="rounded-full p-1 hover:bg-flathub-gray-x11/50 dark:hover:bg-flathub-gainsborow/10"
                            aria-hidden="true"
                            tabIndex={-1}
                            onClick={onClickSearch}
                          >
                            <HiMagnifyingGlass className="h-5 w-5 text-flathub-spanish-gray" />
                          </button>
                        </div>
                        <form
                          id="search-form"
                          role="search"
                          onSubmit={onSubmit}
                        >
                          <input
                            id="search"
                            name="q'"
                            onChange={onChange}
                            value={query}
                            className={clsx(
                              "peer",
                              "block w-full rounded-full bg-flathub-gainsborow/50 py-2 ps-10 text-sm text-flathub-dark-gunmetal focus:border-flathub-dark-gunmetal dark:bg-flathub-dark-gunmetal",
                              "placeholder-flathub-dark-gunmetal/50 focus:placeholder-flathub-dark-gunmetal/75 focus:outline-none dark:placeholder-flathub-granite-gray dark:focus:placeholder-flathub-sonic-silver dark:focus:outline-none",
                              "focus:ring-1 focus:ring-flathub-dark-gunmetal dark:text-flathub-gainsborow dark:focus:border-flathub-gainsborow",
                              "dark:focus:text-white dark:focus:ring-flathub-gainsborow sm:text-sm",
                              "pe-2",
                            )}
                            placeholder={t("search-apps")}
                            type="search"
                          />
                          {!query && (
                            <div className="pointer-events-none absolute inset-y-0 end-0 hidden items-center pe-5 peer-focus:hidden md:flex">
                              <kbd
                                className="flex h-5 w-5 items-center justify-center rounded border-2 border-flathub-gray-x11/60 font-sans text-xs text-flathub-arsenic dark:border-flathub-arsenic dark:text-flathub-gainsborow"
                                aria-hidden="true"
                              >
                                /
                              </kbd>
                            </div>
                          )}
                        </form>
                      </div>
                    </div>
                  </div>
                </search>
                <div className="flex items-center md:absolute md:inset-y-0 md:end-0 lg:hidden">
                  <MobileMenuButton
                    open={open}
                    close={close}
                    width={size.width}
                  />
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
                          {t(item.name)}
                        </a>
                      )
                    } else {
                      return (
                        <Link
                          passHref
                          href={item.href}
                          key={item.name}
                          className="ms-4 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-black transition hover:bg-black/5 dark:text-white dark:hover:bg-white/5"
                        >
                          {t(item.name)}
                        </Link>
                      )
                    }
                  })}
                  {!user.info && (
                    <Link
                      passHref
                      href="/login"
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
                        <Menu.Button className="flex rounded-full bg-white">
                          <span className="sr-only">{t("open-user-menu")}</span>
                          <Avatar
                            userName={displayNameWithFallback}
                            avatarUrl={userAvatarUrl}
                          />
                        </Menu.Button>
                      </div>
                      <Transition
                        as={Fragment}
                        enter="transition ease-out duration-100"
                        enterFrom="transform opacity-0 scale-95"
                        enterTo="transform opacity-100 scale-100"
                        leave="transition ease-in duration-75"
                        leaveFrom="transform opacity-100 scale-100"
                        leaveTo="transform opacity-0 scale-95"
                      >
                        <Menu.Items className="absolute end-0 z-10 mt-2 w-48 origin-top-right rounded-xl bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:border dark:border-flathub-granite-gray dark:bg-flathub-arsenic">
                          {userNavigation
                            .filter(
                              (nav) =>
                                !nav.condition || nav.condition(user?.info),
                            )
                            .map((item) => (
                              <Menu.Item key={item.name}>
                                {({ active }) => (
                                  <Link
                                    passHref
                                    href={item.href}
                                    className={clsx(
                                      active
                                        ? "bg-flathub-gainsborow/50 dark:bg-flathub-granite-gray"
                                        : "",
                                      "block px-4 py-2 text-sm text-flathub-dark-gunmetal transition first:rounded-t-md hover:opacity-75 dark:bg-flathub-arsenic dark:text-flathub-white",
                                    )}
                                  >
                                    {t(item.name)}
                                  </Link>
                                )}
                              </Menu.Item>
                            ))}
                          <Menu.Item key="logout">
                            {({ active }) => (
                              <button
                                onClick={onLogout}
                                className={clsx(
                                  active
                                    ? "bg-flathub-gainsborow/50 dark:bg-flathub-granite-gray"
                                    : "",
                                  "block w-full rounded-b-md px-4 py-2 text-start text-sm font-normal text-flathub-dark-gunmetal transition hover:opacity-75 dark:bg-flathub-arsenic dark:text-flathub-white",
                                )}
                              >
                                {t("log-out")}
                              </button>
                            )}
                          </Menu.Item>
                        </Menu.Items>
                      </Transition>
                    </Menu>
                  )}
                </div>
              </div>
            </div>

            <Popover.Panel as="nav" className="lg:hidden" aria-label="Global">
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
                            {t(item.name)}
                          </a>
                        )
                      } else {
                        return (
                          <Link
                            passHref
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
                        passHref
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
                        <div className="flex-shrink-0">
                          <Image
                            className="rounded-full"
                            src={
                              Object.values(user.info.auths).find(
                                (auth) => auth.avatar,
                              ).avatar
                            }
                            width="38"
                            height="38"
                            alt={t("user-avatar", {
                              user: displayNameWithFallback,
                            })}
                          />
                        </div>
                        <div className="ms-3">
                          <div className="text-base font-medium text-black dark:text-flathub-gainsborow ">
                            {displayNameWithFallback}
                          </div>
                        </div>
                      </div>
                      <div className="mx-auto mt-3 max-w-3xl space-y-1 px-2 sm:px-4">
                        {userNavigation.map((item) => (
                          <Link
                            key={item.name}
                            href={item.href}
                            passHref
                            className="block rounded-md px-3 py-2 text-base font-medium text-black transition hover:bg-black/5 dark:text-flathub-gainsborow dark:hover:bg-white/5"
                            onClick={() => {
                              close()
                            }}
                          >
                            {t(item.name)}
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
            </Popover.Panel>
          </>
        )}
      </Popover>
    </>
  )
}

export default Header
