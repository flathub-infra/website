import { Trans, useTranslation } from "next-i18next"
import { FunctionComponent, ReactElement, useCallback, useState } from "react"
import { verifyApp } from "src/asyncs/app"
import Button from "src/components/Button"
import ProviderLink from "src/components/login/ProviderLink"
import { useUserContext } from "src/context/user-info"
import InlineError from "src/components/InlineError"
import {
  fetchGithubRequestOrgAccessLink,
  fetchLoginProviders,
} from "src/fetchers"
import { useAsync } from "src/hooks/useAsync"
import { VerificationMethodLoginProvider } from "src/types/VerificationAvailableMethods"
import { verificationProviderToHumanReadable } from "src/verificationProvider"
import { FlathubDisclosure } from "../../Disclosure"
import Spinner from "src/components/Spinner"

interface Props {
  appId: string
  method: VerificationMethodLoginProvider
  isNewApp: boolean
  onVerified: () => void
  onReloadNeeded: () => void
}

const LoginVerification: FunctionComponent<Props> = ({
  appId,
  method,
  isNewApp,
  onVerified,
  onReloadNeeded,
}) => {
  const { t } = useTranslation()

  const user = useUserContext()
  const auth = user.info?.auths[method.login_provider]
  const { value: providers } = useAsync(fetchLoginProviders, true)
  const { value: githubOrgAccessLink } = useAsync(
    fetchGithubRequestOrgAccessLink,
    true,
  )
  const [error, setError] = useState("")

  const provider_name = verificationProviderToHumanReadable(
    method.login_provider,
  )

  const { execute: verify, status: verifyStatus } = useAsync(
    useCallback(async () => {
      setError("")

      const result = await verifyApp(appId, isNewApp ?? false)
      if (result?.detail) {
        switch (result.detail) {
          case "user_does_not_exist":
          case "provider_denied_access":
          case "not_org_member":
          case "not_org_admin":
            setError(t("login-provider-verification-failed"))
            break
          default:
            setError(t("error-code", { code: result.detail }))
            break
        }
        onReloadNeeded()
      } else {
        onVerified()
      }
    }, [appId, onReloadNeeded, onVerified, t, isNewApp]),
    false,
  )

  const try_again = (
    <div>
      <Button onClick={verify}>{t("try-again")}</Button>
      {verifyStatus === "pending" && (
        <div className="flex flex-col items-start">
          <Spinner size="s" text={t("verifying")} />
        </div>
      )}
      <InlineError shown={!!error} error={error}></InlineError>
    </div>
  )

  var description: ReactElement
  var content: ReactElement

  if (method.login_is_organization) {
    description = (
      <Trans
        i18nKey={"login-provider-verification-main-instruction-organization"}
      >
        Verify your right to use the app ID
        <span className="font-medium">{{ id: appId }}</span> by logging into an
        account with admin rights to the
        <span className="font-medium">
          {{ login_name: `@${method.login_name}` }}
        </span>
        organization on
        <span className="font-medium">
          {{
            login_provider: provider_name,
          }}
        </span>
        .
      </Trans>
    )
  } else if (method.login_is_organization === false) {
    description = (
      <Trans i18nKey={"login-provider-verification-main-instruction"}>
        Verify your right to use the app ID
        <span className="font-medium">{{ id: appId }}</span> by logging in to
        the account
        <span className="font-medium">
          {{ login_name: `@${method.login_name}` }}
        </span>
        on
        <span className="font-medium">
          {{
            login_provider: provider_name,
          }}
        </span>
        .
      </Trans>
    )
  } else {
    description = (
      <Trans
        i18nKey={
          "login-provider-verification-main-instruction-unknown-is-organization"
        }
      >
        Verify your right to use the app ID
        <span className="font-medium">{{ id: appId }}</span> by logging in to
        the account
        <span className="font-medium">
          {{ login_name: `@${method.login_name}` }}
        </span>
        (or, if
        <span className="font-medium">
          {{ login_name: `@${method.login_name}` }}
        </span>
        is an organization, an account with access to it) on
        <span className="font-medium">
          {{
            login_provider: provider_name,
          }}
        </span>
        .
      </Trans>
    )
  }

  switch (method.login_status) {
    case "ready":
      content = <Button onClick={verify}>{t("verify-app")}</Button>
      break

    case "user_does_not_exist":
      content = (
        <Trans i18nkey={"login-provider-verification-user-does-not-exist"}>
          The account
          <span className="font-medium">
            {{ required_name: method.login_name }}
          </span>
          does not exist on
          <span className="font-medium">
            {{ login_provider: provider_name }}
          </span>
          . You must claim this account name and use it to verify your app, or
          ideally, choose an app ID that you have control over. See
          <a
            href="https://docs.flathub.org/docs/for-app-authors/requirements#application-id"
            target="_blank"
            rel="noreferrer"
            className="no-underline hover:underline"
          >
            the Flatpak documentation
          </a>
          for information about good app IDs.
        </Trans>
      )
      break

    case "not_logged_in":
      const provider = providers?.filter(
        (provider) => provider.method === method.login_provider,
      )[0]

      content = <ProviderLink provider={provider}></ProviderLink>
      break

    case "username_does_not_match":
      content = (
        <Trans i18nKey={"login-provider-verification-switch-account"}>
          You are currently logged in to
          <span className="font-medium">
            {{ login_provider: provider_name }}
          </span>
          as
          <span className="font-medium">
            {{ current_name: `@${auth.login}` }}
          </span>
          . Log in as
          <span className="font-medium">
            {{ required_name: `@${method.login_name}` }}
          </span>
          to verify <span className="font-medium">{{ appId }}</span> by login
          provider, or choose another method if one is available.
        </Trans>
      )
      break

    case "provider_denied_access":
      content = (
        <>
          <p>
            <Trans i18nKey={"login-provider-verification-enable-github-app"}>
              To continue verification, Flathub needs permission to read your
              membership level in the
              <span className="font-medium">
                {{ organization: `@${method.login_name}` }}
              </span>
              organization. You can grant this permission
              <a
                className="no-underline hover:underline"
                href={githubOrgAccessLink}
                target="_blank"
                rel="noreferrer"
              >
                in your GitHub settings
              </a>
              .
            </Trans>
          </p>
          {try_again}
        </>
      )
      break

    case "not_org_member":
      content = (
        <>
          <p>
            <Trans i18nKey={"login-provider-verification-not-org-member"}>
              You are currently logged in to
              <span className="font-medium">
                {{ login_provider: `@${provider_name}` }}
              </span>
              as
              <span className="font-medium">
                {{ current_name: `@${auth.login}` }}
              </span>
              . This account is not a member of the
              <span className="font-medium">
                {{ organization: `@${method.login_name}` }}
              </span>
              organization. To verify this app, you must request admin
              privileges in the organization or sign into an account that
              already has them.
            </Trans>
          </p>
          {try_again}
        </>
      )
      break

    case "not_org_admin":
      content = (
        <>
          <p>
            <Trans i18nKey={"login-provider-verification-not-org-admin"}>
              You are currently logged in to
              <span className="font-medium">
                {{ login_provider: `@${provider_name}` }}
              </span>
              as
              <span className="font-medium">
                {{ current_name: `@${auth.login}` }}
              </span>
              . This account is not an admin of the
              <span className="font-medium">
                {{ organization: `@${method.login_name}` }}
              </span>
              organization. To verify this app, you must request admin
              privileges in the organization or sign into an account that
              already has them.
            </Trans>
          </p>
          {try_again}
        </>
      )
  }

  return (
    <FlathubDisclosure
      buttonItems={
        <h4 className="text-xl font-medium">
          {t("login-provider-verification")}
        </h4>
      }
    >
      <p>{description}</p>

      {content}
    </FlathubDisclosure>
  )
}

export default LoginVerification
