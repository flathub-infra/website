import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import { FunctionComponent, useEffect, useState } from "react"
import { toast } from "react-toastify"
import { LOGIN_PROVIDERS_URL } from "../../env"
import { useLocalStorage } from "../../hooks/useLocalStorage"
import { LoginProvider, LoginRedirect } from "../../types/Login"
import Image from "next/image"

interface Props {
  provider: LoginProvider
}

const ProviderLink: FunctionComponent<Props> = ({ provider }) => {
  const { t } = useTranslation()
  const router = useRouter()

  // Using state to prevent user repeatedly initiating fetches
  const [clicked, setClicked] = useState(false)

  const [, setReturnTo] = useLocalStorage<string>("returnTo", "")

  // When user clicks a provider, a redirect is fetched to initiate login flow
  useEffect(() => {
    const redirect = async (url: string) => {
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
        setReturnTo(router.query.returnTo as string)
        window.location.href = data.redirect
      } else {
        toast.error(`${res.status} ${res.statusText}`)
        setClicked(false)
      }
    }

    if (clicked) {
      redirect(`${LOGIN_PROVIDERS_URL}/${provider.method}`)
    }
  }, [clicked, provider.method, router, setReturnTo, t])

  const loginText = t(`login-with-provider`, { provider: provider.name })

  return (
    <button
      className="flex w-full flex-row items-center justify-center gap-3 rounded-xl border border-textSecondary bg-bgColorSecondary p-5 shadow-md hover:cursor-pointer hover:opacity-75 active:bg-bgColorPrimary md:w-auto"
      onClick={() => setClicked(true)}
    >
      <Image
        src={`/img/login/${provider.method}-logo.svg`}
        width="60"
        height="60"
        alt={loginText}
      />
      {loginText}
    </button>
  )
}

export default ProviderLink
