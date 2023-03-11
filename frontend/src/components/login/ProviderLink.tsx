import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import { FunctionComponent, useCallback, useState } from "react"
import { toast } from "react-toastify"
import { LOGIN_PROVIDERS_URL } from "../../env"
import { useLocalStorage } from "../../hooks/useLocalStorage"
import { LoginProvider, LoginRedirect } from "../../types/Login"
import { GoogleLogo } from "./GoogleLogo"
import { GnomeLogo } from "./GnomeLogo"
import { GitlabLogo } from "./GitlabLogo"
import { GithubLogo } from "./GithubLogo"
import { classNames } from "src/styling"

interface Props {
  provider: LoginProvider
  inACard?: boolean
}

const ProviderLink: FunctionComponent<Props> = ({
  provider,
  inACard = false,
}) => {
  const { t } = useTranslation()
  const router = useRouter()

  // Using state to prevent user repeatedly initiating fetches
  const [clicked, setClicked] = useState(false)

  const [, setReturnTo] = useLocalStorage<string>("returnTo", "")

  // When user clicks a provider, a redirect is fetched to initiate login flow
  const onClick = useCallback(async () => {
    // Prevent multiple async requests
    if (clicked) return
    setClicked(true)

    const url = `${LOGIN_PROVIDERS_URL}/${provider.method}`

    let res: Response
    try {
      res = await fetch(url, {
        // Must use the session cookie sent back
        credentials: "include",
        // Redirects are unique each time
        cache: "no-store",
      })
    } catch {
      // Allow the user to try again on network error
      toast.error(t("network-error-try-again"))
      setClicked(false)
      return
    }

    if (res.ok) {
      const data: LoginRedirect = await res.json()
      setReturnTo((router.query.returnTo as string) ?? "")
      window.location.href = data.redirect
    } else {
      toast.error(`${res.status} ${res.statusText}`)
      setClicked(false)
    }
  }, [clicked, setClicked, t, router, setReturnTo, provider.method])

  const loginText = t(`login-with-provider`, { provider: provider.name })

  return (
    <button
      className={classNames(
        "flex w-full flex-row items-center justify-center gap-3 rounded-xl font-bold",
        "p-5 shadow-md hover:cursor-pointer hover:opacity-60",
        inACard
          ? "bg-flathub-white dark:bg-flathub-dark-gunmetal"
          : "bg-flathub-white dark:bg-flathub-arsenic",
      )}
      onClick={onClick}
    >
      <div className="flex h-16 w-16 items-center justify-center">
        {provider.method === "github" && <GithubLogo />}
        {provider.method === "google" && <GoogleLogo />}
        {provider.method === "gnome" && <GnomeLogo />}
        {provider.method === "gitlab" && <GitlabLogo />}
      </div>
      {loginText}
    </button>
  )
}

export default ProviderLink
