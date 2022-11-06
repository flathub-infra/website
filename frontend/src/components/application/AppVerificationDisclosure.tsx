import { Disclosure, Transition } from "@headlessui/react"
import { Trans, useTranslation } from "next-i18next"
import { FunctionComponent, ReactElement } from "react"
import { HiChevronRight } from "react-icons/hi2"
import { verifyApp } from "src/asyncs/app"
import { VerificationAvailableMethods } from "src/types/VerificationAvailableMethods"
import { verificationProviderToHumanReadable } from "src/verificationProvider"
import Button from "../Button"

interface Props {
  appId: string
  verificationMethods: VerificationAvailableMethods | null
}

function classNames(...classes) {
  return classes.filter(Boolean).join(" ")
}

const FlathubDisclosure: FunctionComponent<{
  buttonText: string
  children: ReactElement | ReactElement[]
}> = ({ buttonText, children }): ReactElement => {
  return (
    <Disclosure>
      {({ open }) => (
        <>
          <Disclosure.Button className="flex w-full items-center gap-3 bg-bgColorSecondary px-4 py-3">
            <HiChevronRight
              className={classNames(
                open ? "rotate-90 " : "",
                "h-6 w-6 transform text-textSecondary duration-150",
              )}
            />
            <h4 className="text-xl font-medium">{buttonText}</h4>
          </Disclosure.Button>
          <Transition
            enter="transition duration-100 ease-out"
            enterFrom="transform scale-95 opacity-0"
            enterTo="transform scale-100 opacity-100"
            leave="transition duration-75 ease-out"
            leaveFrom="transform scale-100 opacity-100"
            leaveTo="transform scale-95 opacity-0"
          >
            <Disclosure.Panel>{children}</Disclosure.Panel>
          </Transition>
        </>
      )}
    </Disclosure>
  )
}

const AppVerificationDisclosure: FunctionComponent<Props> = ({
  verificationMethods,
  appId,
}) => {
  const { t } = useTranslation()

  return (
    <>
      {verificationMethods?.methods.map((methodType) => {
        if (methodType.method === "website") {
          return (
            <FlathubDisclosure
              key={methodType.method}
              buttonText={t("website-verification")}
            >
              <Trans i18nKey={"website-validation-instruction"}>
                To verify your app, we can check you have access to the website
                corresponding to your app id.
                <div>Please add a file named:</div>
                <div className="p-3 font-medium">
                  org.flathub.VerifiedApps.txt
                </div>
                to the
                <div className="p-3 font-medium">.well-known</div>
                folder of your website
                <div className="p-3 font-medium">
                  {{ url: methodType.website }}
                </div>
                the following contents:
                <div className="p-3 font-medium">{{ id: appId }}</div>
              </Trans>
              <br />
              <a
                href={`https://${methodType.website}/.well-known/org.flathub.VerifiedApps.txt`}
              >
                {t("link-to-well-known-file")}
              </a>
            </FlathubDisclosure>
          )
        }
        if (methodType.method === "login_provider") {
          return (
            <FlathubDisclosure
              key={methodType.method}
              buttonText={t("login-provider-verification")}
            >
              <Trans i18nKey={"login-provider-validation-instruction"}>
                We&apos;ll try to verify your access to the app with your user
                <div className="p-3 font-medium">{methodType.login_name}</div>
                with your account on
                <div className="p-3 font-medium">
                  {verificationProviderToHumanReadable(
                    methodType.login_provider,
                  )}
                </div>
              </Trans>
              <Button onClick={() => verifyApp(appId)}>
                {t("verify-app")}
              </Button>
            </FlathubDisclosure>
          )
        }
      })}
    </>
  )
}

export default AppVerificationDisclosure
