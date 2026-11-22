import { Suspense, type ComponentProps } from "react"
import { useSearchParams } from "next/navigation"
import { Link, usePathname } from "src/i18n/navigation"
import { loginHref } from "../login/loginHref"

type Props = Pick<
  ComponentProps<typeof Link>,
  "children" | "className" | "onClick"
>

function TranslationLoginLink({
  pathname,
  ...props
}: Props & { pathname: string }) {
  const languages = useSearchParams().getAll("language")
  const language = languages.length === 1 ? languages[0] : undefined
  return <Link {...props} href={loginHref(pathname, language)} />
}

export default function HeaderLoginLink({
  mobile,
  ...props
}: Props & { mobile?: boolean }) {
  const pathname = usePathname()
  if (/^\/apps\/[^/]+\/translate\/?$/.test(pathname)) {
    return (
      <Suspense fallback={null}>
        <TranslationLoginLink {...props} pathname={pathname} />
      </Suspense>
    )
  }
  return <Link {...props} href={mobile ? "/login" : loginHref(pathname)} />
}
