import { type AnchorHTMLAttributes } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"
import HeaderLoginLink from "./HeaderLoginLink"

const usePathname = vi.hoisted(() => vi.fn<() => string>())
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("language=de&unrelated=1"),
}))
vi.mock("src/i18n/navigation", () => ({
  usePathname,
  Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}))

it.each([
  {
    pathname: "/apps/org.example.App/translate",
    mobile: false,
    href: "/login?returnTo=%2Fapps%2Forg.example.App%2Ftranslate%3Flanguage%3Dde",
  },
  { pathname: "/about", mobile: false, href: "/login?returnTo=%2Fabout" },
  { pathname: "/about", mobile: true, href: "/login" },
])(
  "links to login from $pathname (mobile: $mobile)",
  ({ pathname, mobile, href }) => {
    usePathname.mockReturnValue(pathname)
    const html = renderToStaticMarkup(
      <HeaderLoginLink mobile={mobile}>Login</HeaderLoginLink>,
    )
    expect(html).toContain(`href="${href}"`)
  },
)
