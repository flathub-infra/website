import { ChangeEvent, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import { HiSearch, HiOutlineX, HiOutlineMenu } from "react-icons/hi"

import { LogoJsonLd, SiteLinksSearchBoxJsonLd } from "next-seo"
import { env } from "process"
import { useTranslation } from "next-i18next"
import { IS_PRODUCTION } from "../../env"
import { useUserContext, useUserDispatch } from "../../context/user-info"
import Image from "next/image"
import { Fragment } from "react"
import { Menu, Popover, Transition } from "@headlessui/react"
import { toast } from "react-toastify"
import { logout } from "src/asyncs/login"
import { BsSlashSquare } from "react-icons/bs"

const navigation = [
  {
    name: "publish",
    href: "https://github.com/flathub/flathub/wiki/App-Submission",
    current: false,
  },
  { name: "forum", href: "https://discourse.flathub.org/", current: false },
  { name: "about", href: "/about", current: false },
]

const userNavigation = [
  { name: "your-profile", href: "/userpage" },
  { name: "view-wallet", href: "/wallet" },
]

function classNames(...classes) {
  return classes.filter(Boolean).join(" ")
}

const Header = () => {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const user = useUserContext()

  const [query, setQuery] = useState("")

  // Using state to prevent user repeatedly initiating fetches
  const [clickedLogout, setClickedLogout] = useState(false)
  const dispatch = useUserDispatch()

  // Only make a request on first logout click
  useEffect(() => {
    if (clickedLogout) {
      logout(dispatch).catch((err) => {
        toast.error(t(err))
        setClickedLogout(false)
      })
    }
  }, [dispatch, clickedLogout, t])

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
    if (query !== "") {
      const queryEncoded = encodeURIComponent(query)
      router.push(`/apps/search/${queryEncoded}`)
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

  return (
    <>
      <Popover
        as="header"
        className={({ open }) =>
          classNames(
            open ? "fixed inset-0 overflow-y-auto" : "",
            "fixed z-40 w-full bg-colorPrimary shadow-sm lg:overflow-y-visible",
          )
        }
      >
        {({ open }) => (
          <>
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="relative flex justify-between lg:gap-8 xl:grid xl:grid-cols-12">
                <div className="flex md:absolute md:inset-y-0 md:left-0 lg:static xl:col-span-4">
                  <div className="flex h-full w-full flex-shrink-0 items-center">
                    <LogoJsonLd
                      logo={`${env.NEXT_PUBLIC_BASE_URL}/img/logo/flathub-logo-toolbar.svg`}
                      url={`${env.NEXT_PUBLIC_BASE_URL}`}
                    />
                    <Link href="/" passHref>
                      <div
                        className="h-10 w-10 cursor-pointer rounded-lg bg-[url('/img/flathub-logo.png')] bg-contain bg-center bg-no-repeat px-4 py-2 hover:bg-colorHighlight lg:w-[150px] lg:bg-[url('/img/logo/flathub-logo-toolbar.svg')] lg:bg-auto lg:bg-origin-content"
                        title={t("go-home")}
                      />
                    </Link>
                  </div>
                </div>
                <div className="min-w-0 flex-1 md:px-8 lg:px-0 xl:col-span-4">
                  <div className="flex items-center px-6 py-4 md:mx-auto md:max-w-3xl lg:mx-0 lg:max-w-none xl:px-0">
                    <div className="w-full xl:mx-auto xl:w-[400px]">
                      <SiteLinksSearchBoxJsonLd
                        url={process.env.NEXT_PUBLIC_SITE_BASE_URI}
                        potentialActions={[
                          {
                            target: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/apps/search/{search_term_string}`,
                            queryInput: "search_term_string",
                          },
                        ]}
                      />
                      <label htmlFor="search" className="sr-only">
                        {t("search-apps")}
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <HiSearch
                            className="h-5 w-5 text-gray-400"
                            aria-hidden="true"
                          />
                        </div>
                        <form id="search-form" onSubmit={onSubmit}>
                          <input
                            id="search"
                            name="q'"
                            onChange={onChange}
                            value={query}
                            className={
                              (i18n.dir() === "rtl" ? "md:pr-10 " : "") +
                              "block w-full rounded-full bg-bgColorPrimary py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:border-textPrimary focus:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-textPrimary dark:text-textPrimary dark:focus:text-white sm:text-sm"
                            }
                            placeholder={t("search-apps")}
                            type="search"
                          />
                          {!query && (
                            <div className="pointer-events-none absolute inset-y-0 right-0 hidden items-center pr-5 focus:hidden md:flex">
                              <BsSlashSquare
                                className="h-4 w-4 text-gray-400"
                                aria-hidden="true"
                              />
                            </div>
                          )}
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center md:absolute md:inset-y-0 md:right-0 lg:hidden">
                  {/* Mobile menu button */}
                  <Popover.Button className="-mx-2 inline-flex items-center justify-center rounded-md p-2 text-white hover:bg-colorHighlight focus:outline-none">
                    <span className="sr-only">{t("open-menu")}</span>
                    {open ? (
                      <HiOutlineX
                        className="block h-6 w-6"
                        aria-hidden="true"
                      />
                    ) : (
                      <HiOutlineMenu
                        className="block h-6 w-6"
                        aria-hidden="true"
                      />
                    )}
                  </Popover.Button>
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
                          className="ml-4 inline-flex items-center rounded-md border border-transparent bg-colorPrimary px-4 py-2 text-sm font-medium text-white no-underline hover:bg-colorHighlight"
                        >
                          {t(item.name)}
                        </a>
                      )
                    } else {
                      return (
                        <Link passHref href={item.href} key={item.name}>
                          <a className="ml-4 inline-flex items-center rounded-md border border-transparent bg-colorPrimary px-4 py-2 text-sm font-medium text-white no-underline hover:bg-colorHighlight">
                            {t(item.name)}
                          </a>
                        </Link>
                      )
                    }
                  })}
                  {!IS_PRODUCTION && !user.info && (
                    <Link passHref href="/login" key="login">
                      <a className="ml-4 inline-flex items-center rounded-md border border-transparent bg-colorPrimary px-4 py-2 text-sm font-medium text-white no-underline hover:bg-colorHighlight">
                        {t("login")}
                      </a>
                    </Link>
                  )}

                  {/* Profile dropdown */}
                  {user.info && (
                    <Menu as="div" className="colorPrimary-0 relative ml-5">
                      <div>
                        <Menu.Button className="flex rounded-full bg-white no-underline">
                          <span className="sr-only">{t("open-user-menu")}</span>
                          <Image
                            className="rounded-full"
                            src={
                              Object.values(user.info.auths).find(
                                (auth) => auth.avatar,
                              ).avatar
                            }
                            width="38"
                            height="38"
                            layout="fixed"
                            alt={t("user-avatar", {
                              user: user.info.displayname,
                            })}
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
                        <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                          {userNavigation.map((item) => (
                            <Menu.Item key={item.name}>
                              {({ active }) => (
                                <Link passHref href={item.href}>
                                  <a
                                    className={classNames(
                                      active ? "bg-gray-100" : "",
                                      "block py-2 px-4 text-sm text-gray-700 no-underline hover:opacity-75",
                                    )}
                                  >
                                    {t(item.name)}
                                  </a>
                                </Link>
                              )}
                            </Menu.Item>
                          ))}
                          <Menu.Item key="logout">
                            {({ active }) => (
                              <button
                                onClick={() => {
                                  setClickedLogout(true)
                                }}
                                className={classNames(
                                  active ? "bg-gray-100" : "",
                                  "block w-full py-2 px-4 text-left text-sm font-normal text-gray-700 hover:bg-white hover:opacity-75",
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
                  <div className="mx-auto max-w-3xl space-y-1 px-2 pt-2 pb-3 sm:px-4">
                    {navigation.map((item) => {
                      if (item.href.startsWith("http")) {
                        return (
                          <a
                            key={item.name}
                            href={item.href}
                            target="_blank"
                            rel="noreferrer"
                            aria-current={item.current ? "page" : undefined}
                            className={classNames(
                              item.current
                                ? "bg-colorHighlight"
                                : "hover:bg-colorHighlight",
                              "block rounded-md py-2 px-3 text-base font-medium text-white no-underline dark:text-textPrimary",
                            )}
                          >
                            {t(item.name)}
                          </a>
                        )
                      } else {
                        return (
                          <Link passHref href={item.href} key={item.name}>
                            <a
                              key={item.name}
                              onClick={() => {
                                navigation.forEach((nav) => {
                                  nav.current = nav.name === item.name
                                })
                                close()
                              }}
                              aria-current={item.current ? "page" : undefined}
                              className={classNames(
                                item.current
                                  ? "bg-colorHighlight"
                                  : "hover:bg-colorHighlight",
                                "block rounded-md py-2 px-3 text-base font-medium text-white no-underline dark:text-textPrimary",
                              )}
                            >
                              {t(item.name)}
                            </a>
                          </Link>
                        )
                      }
                    })}
                    {!IS_PRODUCTION && !user.info && (
                      <Link passHref href="/login" key="login">
                        <a
                          key={"login"}
                          className={classNames(
                            "block rounded-md py-2 px-3 text-base font-medium text-white no-underline hover:bg-colorHighlight dark:text-textPrimary",
                          )}
                          onClick={() => {
                            close()
                          }}
                        >
                          {t("login")}
                        </a>
                      </Link>
                    )}
                  </div>
                  {user.info && (
                    <div className="border-t border-gray-200 pt-4 pb-3 dark:border-zinc-600">
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
                            layout="fixed"
                            alt={t("user-avatar", {
                              user: user.info.displayname,
                            })}
                          />
                        </div>
                        <div className="ml-3">
                          <div className="text-base font-medium text-white dark:text-textPrimary ">
                            {user.info.displayname}
                          </div>
                        </div>
                      </div>
                      <div className="mx-auto mt-3 max-w-3xl space-y-1 px-2 sm:px-4">
                        {userNavigation.map((item) => (
                          <Link key={item.name} href={item.href} passHref>
                            <a
                              className="block rounded-md py-2 px-3 text-base font-medium text-white no-underline hover:bg-colorHighlight dark:text-textPrimary"
                              onClick={() => {
                                close()
                              }}
                            >
                              {t(item.name)}
                            </a>
                          </Link>
                        ))}
                        <button
                          key={"logout"}
                          onClick={() => {
                            setClickedLogout(true)
                            close()
                          }}
                          className="block w-full rounded-md py-2 px-3 text-left text-base font-medium text-white hover:bg-colorHighlight dark:text-textPrimary"
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
