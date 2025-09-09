import { FunctionComponent, ReactElement, ReactNode, useState } from "react"
import ProviderLink from "src/components/login/ProviderLink"
import { useUserContext } from "src/context/user-info"
import InlineError from "src/components/InlineError"
import { verificationProviderToHumanReadable } from "src/verificationProvider"
import { FlathubDisclosure } from "../../Disclosure"
import Spinner from "src/components/Spinner"
import { useQuery } from "@tanstack/react-query"
import {
  getLoginMethodsAuthLoginGet,
  useVerifyByLoginProviderVerificationAppIdVerifyByLoginProviderPost,
} from "src/codegen"
import { requestOrganizationAccessGithubVerificationRequestOrganizationAccessGithubGet } from "src/codegen"
import { AvailableMethod } from "src/codegen/model"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"

interface Props {
  appId: string
  method: AvailableMethod
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
  const t = useTranslations()

  const user = useUserContext()
  const auth = user.info?.auths[method.login_provider]

  const { data: providers } = useQuery({
    queryKey: ["login-providers"],
    queryFn: ({ signal }) => getLoginMethodsAuthLoginGet({ signal }),
  })

  const { data: githubOrgAccessLink } = useQuery({
    queryKey: ["github-org-access-link"],
    queryFn: async () => {
      return requestOrganizationAccessGithubVerificationRequestOrganizationAccessGithubGet()
    },
  })

  const [error, setError] = useState("")

  const provider_name = verificationProviderToHumanReadable(
    method.login_provider,
  )

  const verify =
    useVerifyByLoginProviderVerificationAppIdVerifyByLoginProviderPost({
      axios: {
        withCredentials: true,
      },
      mutation: {
        onMutate: () => {
          setError("")
        },
        onSuccess: (result) => {
          if (result?.data?.detail) {
            switch (result.data.detail) {
              case "user_does_not_exist":
              case "provider_denied_access":
              case "not_org_member":
              case "not_org_admin":
                setError(t("login-provider-verification-failed"))
                break
              default:
                setError(t("error-code", { code: result.data.detail }))
                break
            }
            onReloadNeeded()
          } else {
            onVerified()
          }
        },
      },
    })

  const try_again = (
    <div>
      <Button
        size="lg"
        onClick={() =>
          verify.mutate({
            appId: appId,
            params: {
              new_app: isNewApp,
            },
          })
        }
      >
        {t("try-again")}
      </Button>
      {verify.isPending && (
        <div className="flex flex-col items-start">
          <Spinner size="s" text={t("verifying")} />
        </div>
      )}
      <InlineError shown={!!error} error={error}></InlineError>
    </div>
  )

  var description: ReactNode
  var content: ReactElement

  if (method.login_is_organization) {
    description = t.rich(
      "login-provider-verification-main-instruction-organization",
      {
        appid: (chunk) => <span className="font-medium">{appId}</span>,
        orgname: (chunk) => (
          <span className="font-medium">{`@${method.login_name}`}</span>
        ),
        loginprovider: (chunk) => (
          <span className="font-medium">{provider_name}</span>
        ),
      },
    )
  } else if (method.login_is_organization === false) {
    description = t.rich("login-provider-verification-main-instruction", {
      appid: (chunk) => <span className="font-medium">{appId}</span>,
      loginname: (chunk) => (
        <span className="font-medium">{`@${method.login_name}`}</span>
      ),
      loginprovider: (chunk) => (
        <span className="font-medium">{provider_name}</span>
      ),
    })
  } else {
    description = t.rich(
      "login-provider-verification-main-instruction-unknown-is-organization",
      {
        appid: (chunk) => <span className="font-medium">{appId}</span>,
        loginname: (chunk) => (
          <span className="font-medium">{`@${method.login_name}`}</span>
        ),
        orgname: (chunk) => (
          <span className="font-medium">{`@${method.login_name}`}</span>
        ),
        loginprovider: (chunk) => (
          <span className="font-medium">{provider_name}</span>
        ),
      },
    )
  }

  switch (method.login_status) {
    case "ready":
      content = (
        <Button
          size="lg"
          onClick={() =>
            verify.mutate({
              appId: appId,
              params: {
                new_app: isNewApp,
              },
            })
          }
        >
          {t("verify-app")}
        </Button>
      )
      break

    case "user_does_not_exist":
      content = (
        <>
          {t.rich("login-provider-verification-user-does-not-exist", {
            requiredname: (chunk) => (
              <span className="font-medium">{method.login_name}</span>
            ),
            loginprovider: (chunk) => (
              <span className="font-medium">{provider_name}</span>
            ),
            doclink: (chunk) => (
              <a
                href="https://docs.flathub.org/docs/for-app-authors/requirements#application-id"
                target="_blank"
                rel="noreferrer"
                className="no-underline hover:underline"
              >
                {chunk}
              </a>
            ),
          })}
        </>
      )
      break

    case "not_logged_in":
      const provider = providers?.data.filter(
        (provider) => provider.method === method.login_provider,
      )[0]

      content = <ProviderLink provider={provider} />
      break

    case "username_does_not_match":
      content = (
        <>
          {t.rich("login-provider-verification-switch-account", {
            loginprovider: (chunk) => (
              <span className="font-medium">{provider_name}</span>
            ),
            currentname: (chunk) => (
              <span className="font-medium">{`@${auth.login}`}</span>
            ),
            requiredname: (chunk) => (
              <span className="font-medium">{`@${method.login_name}`}</span>
            ),
            appid: (chunk) => <span className="font-medium">{appId}</span>,
          })}
        </>
      )
      break

    case "provider_denied_access":
      content = (
        <>
          <p>
            {t.rich("login-provider-verification-enable-github-app", {
              orgname: (chunk) => (
                <span className="font-medium">{`@${method.login_name}`}</span>
              ),
              settingslink: (chunk) => (
                <a
                  className="no-underline hover:underline"
                  href={githubOrgAccessLink?.data?.link}
                  target="_blank"
                  rel="noreferrer"
                >
                  {chunk}
                </a>
              ),
            })}
          </p>
          {try_again}
        </>
      )
      break

    case "not_org_member":
      content = (
        <>
          <p>
            {t.rich("login-provider-verification-not-org-member", {
              loginprovider: (chunk) => (
                <span className="font-medium">{`@${provider_name}`}</span>
              ),
              currentname: (chunk) => (
                <span className="font-medium">{`@${auth.login}`}</span>
              ),
              orgname: (chunk) => (
                <span className="font-medium">{`@${method.login_name}`}</span>
              ),
            })}
          </p>
          {try_again}
        </>
      )
      break

    case "not_org_admin":
      content = (
        <>
          <p>
            {t.rich("login-provider-verification-not-org-admin", {
              loginprovider: (chunk) => (
                <span className="font-medium">{`@${provider_name}`}</span>
              ),
              currentname: (chunk) => (
                <span className="font-medium">{`@${auth.login}`}</span>
              ),
              orgname: (chunk) => (
                <span className="font-medium">{`@${method.login_name}`}</span>
              ),
            })}
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
