import { Trans, useTranslation } from "next-i18next"
import { FunctionComponent, ReactElement } from "react"
import { verifyApp } from "src/asyncs/app"
import Button from "src/components/Button"
import ProviderLink from "src/components/login/ProviderLink"
import { useUserContext } from "src/context/user-info"
import { fetchLoginProviders } from "src/fetchers"
import { useAsync } from "src/hooks/useAsync"
import { VerificationMethodLoginProvider } from "src/types/VerificationAvailableMethods"
import { verificationProviderToHumanReadable } from "src/verificationProvider"
import { FlathubDisclosure } from "../../Disclosure"

interface Props {
  appId: string
  method: VerificationMethodLoginProvider
  onVerified: () => void
}

const LoginVerification: FunctionComponent<Props> = ({
  appId,
  method,
  onVerified,
}) => {
  const { t } = useTranslation()

  const user = useUserContext()
  const auth = user.info?.auths[method.login_provider]
  const { value: providers } = useAsync(fetchLoginProviders, true)

  const provider_name = verificationProviderToHumanReadable(
    method.login_provider,
  )

  var content: ReactElement

  if (auth) {
    if (auth.login === method.login_name) {
      content = (
        <Button onClick={() => verifyApp(appId).then(() => onVerified())}>
          {t("verify-app")}
        </Button>
      )
    } else {
      content = (
        <Trans i18nKey={"login-provider-verification-switch-account"}>
          You are currently logged in to
          <span className="font-medium">
            {{ login_provider: provider_name }}
          </span>
          as
          <span className="font-medium">@{{ current_name: auth.login }}</span>.
          Log in as
          <span className="font-medium">
            @{{ required_name: method.login_name }}
          </span>
          to verify <span className="font-medium">{{ appId }}</span> by login
          provider, or choose another method if one is available.
        </Trans>
      )
    }
  } else {
    const provider = providers?.filter(
      (provider) => provider.method === method.login_provider,
    )[0]

    content = <ProviderLink provider={provider}></ProviderLink>
  }

  return (
    <FlathubDisclosure
      buttonItems={
        <h4 className="text-xl font-medium">
          {t("login-provider-verification")}
        </h4>
      }
    >
      <p>
        <Trans i18nKey={"login-provider-verification-main-instruction"}>
          Verify your right to use the app ID
          <span className="font-medium">{{ id: appId }}</span> by logging in to
          the account
          <span className="font-medium">
            @{{ login_name: method.login_name }}
          </span>
          on
          <span className="font-medium">
            {{
              login_provider: provider_name,
            }}
          </span>
          .
        </Trans>
      </p>

      {content}
    </FlathubDisclosure>
  )
}

export default LoginVerification
