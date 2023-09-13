import { Fragment } from "react"
import { Popover, Transition } from "@headlessui/react"
import { HiChevronDown } from "react-icons/hi2"
import { clsx } from "clsx"
import Link from "next/link"
import { useMatomo } from "@mitresthen/matomo-tracker-react"
import { Trans, useTranslation } from "next-i18next"
import CodeCopy from "./CodeCopy"

export default function InstallButton({ appId }: { appId: string }) {
  const { t } = useTranslation()

  const { trackEvent } = useMatomo()

  const installClicked = (e) => {
    e.preventDefault()
    trackEvent({ category: "App", action: "Install", name: appId })
    window.location.href = `https://dl.flathub.org/repo/appstream/${appId}.flatpakref`
  }

  const flatpakInstallCopied = () => {
    trackEvent({
      category: "App",
      action: "InstallCmdCopied",
      name: appId ?? "unknown",
    })
  }

  const flatpakRunCopied = () => {
    trackEvent({
      category: "App",
      action: "RunCmdCopied",
      name: appId ?? "unknown",
    })
  }

  return (
    <div className="inline-flex w-52 basis-1/2 rounded-md shadow-sm sm:w-32 md:w-40">
      <Link
        href={`https://dl.flathub.org/repo/appstream/${appId}.flatpakref`}
        onClick={installClicked}
        className={clsx(
          "hover:opacity-75 active:opacity-50",
          "bg-flathub-celestial-blue text-gray-100 dark:bg-flathub-celestial-blue",
          "no-wrap flex h-11 items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap rounded-s-lg px-5 py-2 text-center font-bold no-underline duration-500 hover:cursor-pointer",
          "w-full",
        )}
        role="button"
      >
        {t("install")}
      </Link>
      <Popover as="div" className={clsx("block", "sm:relative")}>
        <Popover.Overlay className="fixed inset-0 z-10 bg-black opacity-30" />
        <Popover.Button
          className={clsx(
            "hover:opacity-75 active:opacity-50",
            "bg-flathub-celestial-blue text-gray-100 dark:bg-flathub-celestial-blue",
            "ms-[1px] h-11 rounded-e-lg px-2 py-2 outline-0 focus:z-10",
          )}
        >
          <span className="sr-only">Open options</span>
          <HiChevronDown className="h-5 w-5" aria-hidden="true" />
        </Popover.Button>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Popover.Panel
            className={clsx(
              "absolute end-0 z-10 mx-2 mt-2 w-fit origin-top-right rounded-xl bg-flathub-white px-4 pb-4 shadow-md dark:bg-flathub-arsenic sm:mx-0 sm:w-[450px]",
            )}
          >
            <h3 className="my-4 text-xl font-semibold">
              {t("manual-install")}
            </h3>
            <p>
              <Trans i18nKey={"common:manual-install-instructions"}>
                Make sure to follow the{" "}
                <Link href="/setup/" className="no-underline hover:underline">
                  setup guide
                </Link>{" "}
                before installing
              </Trans>
            </p>
            <CodeCopy
              text={`flatpak install ${appId}`}
              nested
              onCopy={flatpakInstallCopied}
            />
            <h3 className="my-4 text-xl font-semibold">{t("run")}</h3>
            <CodeCopy
              text={`flatpak run ${appId}`}
              nested
              onCopy={flatpakRunCopied}
            />
          </Popover.Panel>
        </Transition>
      </Popover>
    </div>
  )
}
