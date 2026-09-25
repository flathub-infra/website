import { FunctionComponent, ReactNode } from "react"
import ProviderLink from "./ProviderLink"
import { LoginMethod } from "src/codegen"

interface Props {
  providers: LoginMethod[]
  children?: ReactNode
}

const LoginProviders: FunctionComponent<Props> = ({ providers, children }) => {
  const links = providers.map((p) => (
    <div key={p.method}>
      <ProviderLink provider={p} />
    </div>
  ))

  return (
    <div className="flex flex-col items-center">
      <div className="flex w-full flex-col gap-5 p-5 sm:w-[400px]">
        {children}
        {links}
      </div>
    </div>
  )
}

export default LoginProviders
