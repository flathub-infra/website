import { FunctionComponent, ReactNode } from "react"
import ProviderLink from "./ProviderLink"
import { LoginMethod } from "src/codegen"

interface Props {
  providers: LoginMethod[]
  children?: ReactNode
  compact?: boolean
}

const LoginProviders: FunctionComponent<Props> = ({
  providers,
  children,
  compact = false,
}) => {
  const links = providers.map((p) => (
    <div key={p.method}>
      <ProviderLink provider={p} compact={compact} />
    </div>
  ))

  return (
    <div className="flex w-full flex-col items-center">
      <div
        className={
          compact
            ? "flex w-full flex-col gap-3"
            : "flex w-full flex-col gap-5 p-5 sm:w-[400px]"
        }
      >
        {children}
        {links}
      </div>
    </div>
  )
}

export default LoginProviders
